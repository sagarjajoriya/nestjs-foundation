import { randomBytes } from 'node:crypto';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, seconds } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';
import { authConfig } from '@config/configuration';
import { RefreshTransport } from '@config/env.validation';

import { AuthService } from './auth.service';
import {
  AuthSessionDto,
  AuthTokensDto,
  AuthUserDto,
  MessageResponseDto,
} from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SessionDto } from './dto/session.response.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { CSRF_COOKIE_NAME, CsrfGuard } from './guards/csrf.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AccessToken, RefreshToken } from './interfaces/auth-tokens.interface';
import { extractRequestContext } from './utils/request-context.util';

/** Neutral message used wherever revealing account existence would aid attackers. */
const GENERIC_EMAIL_MESSAGE =
  'If an account matches, an email has been sent with further instructions.';

/**
 * Authentication endpoints under `/v1/auth`. Thin by design — every handler
 * delegates to {@link AuthService}. Refresh-token delivery (cookie/body/both)
 * and CSRF handling live here because they are transport concerns.
 */
@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  @Post('register')
  @ApiOperation({ summary: 'Register with email + password.' })
  @ApiCreatedResponse({ type: AuthSessionDto })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const issued = await this.authService.register(
      dto,
      extractRequestContext(req),
    );
    this.applyRefreshCookies(res, issued.refresh);
    return {
      ...this.buildTokensBody(issued.access, issued.refresh),
      user: new AuthUserDto(issued.principal),
    };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email + password.' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AuthSessionDto })
  async login(
    @CurrentUser() principal: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSessionDto> {
    const issued = await this.authService.login(
      principal,
      extractRequestContext(req),
    );
    this.applyRefreshCookies(res, issued.refresh);
    return {
      ...this.buildTokensBody(issued.access, issued.refresh),
      user: new AuthUserDto(issued.principal),
    };
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate the refresh token and mint a new access token.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokensDto> {
    const presented = this.resolvePresentedToken(req, body);
    if (!presented) {
      throw new UnauthorizedException('Refresh token is required.');
    }
    const result = await this.authService.refresh(
      presented,
      extractRequestContext(req),
    );
    this.applyRefreshCookies(res, result.refresh);
    return this.buildTokensBody(result.access, result.refresh);
  }

  @Public()
  @UseGuards(CsrfGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out the current session.' })
  @ApiNoContentResponse()
  async logout(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logout({
      presentedToken: this.resolvePresentedToken(req, body),
      context: extractRequestContext(req),
    });
    this.clearRefreshCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke every session for the current user.' })
  @ApiNoContentResponse()
  async logoutAll(
    @CurrentUser() principal: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(principal.id, extractRequestContext(req));
    this.clearRefreshCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change password (revokes all sessions).' })
  @ApiNoContentResponse()
  async changePassword(
    @CurrentUser() principal: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.changePassword(
      principal.id,
      dto,
      extractRequestContext(req),
    );
    this.clearRefreshCookies(res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a password-reset email.' })
  @ApiOkResponse({ type: MessageResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    await this.authService.forgotPassword(
      dto.email,
      extractRequestContext(req),
    );
    return { message: GENERIC_EMAIL_MESSAGE };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset a password using a token (revokes sessions).',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    await this.authService.resetPassword(dto, extractRequestContext(req));
    return { message: 'Your password has been reset. Please sign in.' };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address using a token.' })
  @ApiOkResponse({ type: MessageResponseDto })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() req: Request,
  ): Promise<MessageResponseDto> {
    await this.authService.verifyEmail(dto, extractRequestContext(req));
    return { message: 'Your email address has been verified.' };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Resend the email-verification link.' })
  @ApiOkResponse({ type: MessageResponseDto })
  async resendVerification(
    @CurrentUser() principal: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    await this.authService.resendVerification(principal.id);
    return {
      message: 'If your email is unverified, a new link has been sent.',
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'List the current user’s active sessions.' })
  @ApiOkResponse({ type: [SessionDto] })
  async listSessions(
    @CurrentUser() principal: AuthenticatedUser,
  ): Promise<SessionDto[]> {
    const sessions = await this.authService.listSessions(principal.id);
    return sessions.map(
      (session) => new SessionDto(session, principal.sessionId),
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a specific session.' })
  @ApiNoContentResponse()
  async revokeSession(
    @CurrentUser() principal: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.revokeSession(
      principal.id,
      id,
      extractRequestContext(req),
    );
  }

  // ── Transport helpers ───────────────────────────────────────────────────────

  /** Reads the refresh token from the body or the HttpOnly cookie. */
  private resolvePresentedToken(
    req: Request,
    body: RefreshTokenDto,
  ): string | undefined {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    return body.refreshToken ?? cookies[this.config.cookie.name];
  }

  /** Builds the JSON token body, including the refresh token only when the
   * configured transport calls for it. */
  private buildTokensBody(
    access: AccessToken,
    refresh: RefreshToken,
  ): AuthTokensDto {
    const body: AuthTokensDto = {
      accessToken: access.token,
      tokenType: 'Bearer',
      expiresIn: access.expiresIn,
    };
    if (this.config.refresh.transport !== RefreshTransport.Cookie) {
      body.refreshToken = refresh.token;
    }
    return body;
  }

  /** Sets the refresh + CSRF cookies when the transport includes "cookie". */
  private applyRefreshCookies(res: Response, refresh: RefreshToken): void {
    if (this.config.refresh.transport === RefreshTransport.Body) {
      return;
    }
    const base: CookieOptions = {
      secure: this.config.cookie.secure,
      sameSite: this.config.cookie.sameSite,
      domain: this.config.cookie.domain,
      path: this.config.cookie.path,
      expires: refresh.expiresAt,
    };
    res.cookie(this.config.cookie.name, refresh.token, {
      ...base,
      httpOnly: true,
    });
    // Readable double-submit CSRF token paired with the HttpOnly refresh cookie.
    res.cookie(CSRF_COOKIE_NAME, randomBytes(16).toString('hex'), {
      ...base,
      httpOnly: false,
    });
  }

  private clearRefreshCookies(res: Response): void {
    const options = {
      domain: this.config.cookie.domain,
      path: this.config.cookie.path,
    };
    res.clearCookie(this.config.cookie.name, options);
    res.clearCookie(CSRF_COOKIE_NAME, options);
  }
}

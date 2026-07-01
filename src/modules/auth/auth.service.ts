import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Session } from '@prisma/client';
import { VerificationTokenType } from '@prisma/client';

import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';
import { parseDurationToMs } from '@common/utils/duration.util';
import { authConfig } from '@config/configuration';
import { HashingService } from '@security/hashing.service';
import { UsersService } from '@modules/users/users.service';
import type { UserWithRoles } from '@modules/users/users.repository';

import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import {
  AccessToken,
  RefreshToken,
  RequestContext,
} from './interfaces/auth-tokens.interface';
import { JwtAccessPayload } from './interfaces/jwt-payload.interface';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { SessionsRepository } from './repositories/sessions.repository';
import { VerificationTokensRepository } from './repositories/verification-tokens.repository';
import { AuditService, AuthAuditAction } from './services/audit.service';
import { MailService } from './services/mail.service';
import { TokenService } from './services/token.service';

/** A newly issued authenticated session (tokens + principal). */
export interface IssuedSession {
  access: AccessToken;
  refresh: RefreshToken;
  principal: AuthenticatedUser;
}

/** Result of a refresh: a new access token and rotated refresh token. */
export interface RefreshedSession {
  access: AccessToken;
  refresh: RefreshToken;
  principal: AuthenticatedUser;
}

/** Uniform message for all credential failures (no user enumeration). */
const INVALID_CREDENTIALS = 'Invalid email or password.';

/**
 * Orchestrates every authentication flow. Controllers stay thin; all rules
 * (lockout, timing-safe verification, session lifecycle, token rotation,
 * single-use verification tokens, audit) live here.
 */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly refreshTtlMs: number;
  /** A real Argon2 hash verified against unknown accounts to equalize timing. */
  private dummyHash = '';

  constructor(
    private readonly users: UsersService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionsRepository,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly verificationTokens: VerificationTokensRepository,
    private readonly mail: MailService,
    private readonly audit: AuditService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {
    this.refreshTtlMs = parseDurationToMs(config.refresh.ttl);
  }

  async onModuleInit(): Promise<void> {
    // Precompute once so unknown-user logins pay the same hashing cost.
    this.dummyHash = await this.hashing.hash(randomBytes(32).toString('hex'));
  }

  // ── Credential validation (used by the local strategy) ──────────────────────

  async validateCredentials(
    email: string,
    password: string,
    context: RequestContext,
  ): Promise<AuthenticatedUser> {
    const user = await this.users.findAuthUserByEmail(email);

    if (!user || !user.passwordHash) {
      // Burn equivalent time so presence/absence is not timing-distinguishable.
      await this.hashing.verify(this.dummyHash, password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (this.isLocked(user)) {
      await this.audit.record({
        action: AuthAuditAction.LoginFailed,
        userId: user.id,
        metadata: { reason: 'locked' },
        context,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const passwordValid = await this.hashing.verify(
      user.passwordHash,
      password,
    );
    if (!passwordValid) {
      await this.users.registerFailedLogin(user.id, {
        maxFailedLogins: this.config.lockout.maxFailedLogins,
        lockoutMinutes: this.config.lockout.lockoutMinutes,
      });
      await this.audit.record({
        action: AuthAuditAction.LoginFailed,
        userId: user.id,
        context,
      });
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    return this.mapPrincipal(user);
  }

  // ── Login / register ────────────────────────────────────────────────────────

  async login(
    principal: AuthenticatedUser,
    context: RequestContext,
  ): Promise<IssuedSession> {
    const issued = await this.startSession(principal, context);
    await this.users.recordSuccessfulLogin(principal.id);
    await this.audit.record({
      action: AuthAuditAction.Login,
      userId: principal.id,
      context,
    });
    return issued;
  }

  async register(
    dto: RegisterDto,
    context: RequestContext,
  ): Promise<IssuedSession> {
    const user = await this.users.registerLocalUser({
      email: dto.email,
      password: dto.password,
      name: dto.name,
    });
    await this.sendEmailVerificationFor(user);
    const issued = await this.startSession(this.mapPrincipal(user), context);
    await this.audit.record({
      action: AuthAuditAction.Register,
      userId: user.id,
      context,
    });
    return issued;
  }

  // ── Refresh (rotation + reuse detection) ────────────────────────────────────

  async refresh(
    presentedToken: string,
    context: RequestContext,
  ): Promise<RefreshedSession> {
    const rotation = await this.tokens.rotateRefreshToken({
      presentedToken,
      context,
    });

    const session = await this.sessions.findActiveById(rotation.sessionId);
    if (!session) {
      await this.refreshTokens.revokeAllForSession(rotation.sessionId);
      throw new UnauthorizedException('Session is no longer active.');
    }

    const user = await this.users.findAuthUserById(rotation.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const principal = this.mapPrincipal(user, rotation.sessionId);
    const access = await this.tokens.signAccessToken(
      this.toJwtPayload(principal),
    );
    await this.audit.record({
      action: AuthAuditAction.TokenRefreshed,
      userId: user.id,
      context,
    });

    return { access, refresh: rotation.refresh, principal };
  }

  // ── Logout ──────────────────────────────────────────────────────────────────

  /** Revokes the current session. Idempotent; resolves the session from the
   * access-token principal or the presented refresh token. */
  async logout(input: {
    principal?: AuthenticatedUser;
    presentedToken?: string;
    context: RequestContext;
  }): Promise<void> {
    let sessionId = input.principal?.sessionId;
    let userId = input.principal?.id;

    if (!sessionId && input.presentedToken) {
      const record = await this.refreshTokens.findByHash(
        this.tokens.hashToken(input.presentedToken),
      );
      sessionId = record?.sessionId ?? undefined;
      userId = record?.userId ?? userId;
    }

    if (sessionId) {
      await this.sessions.revoke(sessionId);
      await this.refreshTokens.revokeAllForSession(sessionId);
    }

    await this.audit.record({
      action: AuthAuditAction.Logout,
      userId: userId ?? null,
      context: input.context,
    });
  }

  async logoutAll(userId: string, context: RequestContext): Promise<void> {
    await this.sessions.revokeAllForUser(userId);
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.record({
      action: AuthAuditAction.LogoutAll,
      userId,
      context,
    });
  }

  // ── Password change / reset ─────────────────────────────────────────────────

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<void> {
    const user = await this.users.findAuthUserById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Authentication is required.');
    }
    const ok = await this.hashing.verify(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!ok) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    await this.users.setPassword(userId, dto.newPassword);
    // Invalidate all sessions so a changed password forces re-authentication.
    await this.revokeEverything(userId);
    await this.audit.record({
      action: AuthAuditAction.PasswordChanged,
      userId,
      context,
    });
  }

  /** Always resolves without revealing whether the account exists. */
  async forgotPassword(email: string, context: RequestContext): Promise<void> {
    const user = await this.users.findAuthUserByEmail(email);
    if (!user) {
      return;
    }
    const token = await this.issueVerificationToken(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
      this.config.verification.passwordResetTtlMinutes,
    );
    await this.mail.sendPasswordReset({
      email: user.email,
      name: user.name,
      url: this.buildLink('reset-password', token),
    });
    await this.audit.record({
      action: AuthAuditAction.PasswordResetRequested,
      userId: user.id,
      context,
    });
  }

  async resetPassword(
    dto: ResetPasswordDto,
    context: RequestContext,
  ): Promise<void> {
    const record = await this.consumeValidToken(
      dto.token,
      VerificationTokenType.PASSWORD_RESET,
    );
    await this.users.setPassword(record.userId, dto.newPassword);
    await this.revokeEverything(record.userId);
    await this.audit.record({
      action: AuthAuditAction.PasswordReset,
      userId: record.userId,
      context,
    });
  }

  // ── Email verification ──────────────────────────────────────────────────────

  async verifyEmail(
    dto: VerifyEmailDto,
    context: RequestContext,
  ): Promise<void> {
    const record = await this.consumeValidToken(
      dto.token,
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    await this.users.markEmailVerified(record.userId);
    await this.audit.record({
      action: AuthAuditAction.EmailVerified,
      userId: record.userId,
      context,
    });
  }

  /** Re-sends verification for the current user (no-op if already verified). */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findAuthUserById(userId);
    if (user && user.emailVerifiedAt === null) {
      await this.sendEmailVerificationFor(user);
    }
  }

  // ── Session management ──────────────────────────────────────────────────────

  listSessions(userId: string): Promise<Session[]> {
    return this.sessions.findActiveByUser(userId);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    context: RequestContext,
  ): Promise<void> {
    const session = await this.sessions.findActiveById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found.');
    }
    await this.sessions.revoke(sessionId);
    await this.refreshTokens.revokeAllForSession(sessionId);
    await this.audit.record({
      action: AuthAuditAction.SessionRevoked,
      userId,
      metadata: { sessionId },
      context,
    });
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async startSession(
    principal: AuthenticatedUser,
    context: RequestContext,
  ): Promise<IssuedSession> {
    const session = await this.sessions.create({
      userId: principal.id,
      expiresAt: new Date(Date.now() + this.refreshTtlMs),
      userAgent: context.userAgent,
      ipAddress: context.ipAddress,
    });
    const withSession: AuthenticatedUser = {
      ...principal,
      sessionId: session.id,
    };
    const access = await this.tokens.signAccessToken(
      this.toJwtPayload(withSession),
    );
    const refresh = await this.tokens.issueRefreshToken({
      userId: principal.id,
      sessionId: session.id,
      context,
    });
    return { access, refresh, principal: withSession };
  }

  private async revokeEverything(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId);
    await this.refreshTokens.revokeAllForUser(userId);
  }

  private async issueVerificationToken(
    userId: string,
    type: VerificationTokenType,
    ttlMinutes: number,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.verificationTokens.consumeOutstanding(userId, type);
    await this.verificationTokens.create({
      userId,
      type,
      tokenHash: this.tokens.hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    });
    return token;
  }

  private async consumeValidToken(
    rawToken: string,
    type: VerificationTokenType,
  ): Promise<{ userId: string }> {
    const record = await this.verificationTokens.findByHash(
      this.tokens.hashToken(rawToken),
    );
    if (
      !record ||
      record.type !== type ||
      record.consumedAt !== null ||
      record.expiresAt.getTime() <= Date.now()
    ) {
      throw new BadRequestException('Invalid or expired token.');
    }
    await this.verificationTokens.consume(record.id);
    return { userId: record.userId };
  }

  private async sendEmailVerificationFor(user: UserWithRoles): Promise<void> {
    const token = await this.issueVerificationToken(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
      this.config.verification.emailTtlMinutes,
    );
    await this.mail.sendEmailVerification({
      email: user.email,
      name: user.name,
      url: this.buildLink('verify-email', token),
    });
  }

  private isLocked(user: UserWithRoles): boolean {
    return user.lockedUntil !== null && user.lockedUntil.getTime() > Date.now();
  }

  private mapPrincipal(
    user: UserWithRoles,
    sessionId?: string,
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      roles: user.userRoles.map((userRole) => userRole.role.name),
      sessionId,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  private toJwtPayload(principal: AuthenticatedUser): JwtAccessPayload {
    return {
      sub: principal.id,
      email: principal.email,
      roles: principal.roles,
      sid: principal.sessionId ?? '',
      emailVerified: principal.emailVerified,
    };
  }

  private buildLink(path: string, token: string): string {
    const base = this.config.publicUrl.replace(/\/$/, '');
    return `${base}/${path}?token=${encodeURIComponent(token)}`;
  }
}

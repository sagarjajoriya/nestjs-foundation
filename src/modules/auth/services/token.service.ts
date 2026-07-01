import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PinoLogger } from 'nestjs-pino';

import { authConfig } from '@config/configuration';
import { parseDurationToMs } from '@common/utils/duration.util';

import {
  AccessToken,
  RefreshToken,
  RequestContext,
} from '../interfaces/auth-tokens.interface';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';
import { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import { SessionsRepository } from '../repositories/sessions.repository';

/** Result of a successful refresh-token rotation. */
export interface RotationResult {
  userId: string;
  sessionId: string;
  refresh: RefreshToken;
}

/**
 * Owns all token cryptography and refresh-token lifecycle.
 *
 *  - Access tokens: signed RS256 JWTs (via the configured `JwtService`).
 *  - Refresh tokens: opaque 256-bit random strings, persisted only as SHA-256
 *    hashes, rotated on every use with automatic reuse (theft) detection.
 */
@Injectable()
export class TokenService {
  private readonly refreshTtlMs: number;
  private readonly accessTtlSeconds: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokensRepository,
    private readonly sessions: SessionsRepository,
    @Inject(authConfig.KEY)
    config: ConfigType<typeof authConfig>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(TokenService.name);
    this.refreshTtlMs = parseDurationToMs(config.refresh.ttl);
    this.accessTtlSeconds = Math.floor(
      parseDurationToMs(config.jwt.accessTtl) / 1000,
    );
  }

  /** Signs a short-lived RS256 access token. */
  async signAccessToken(payload: JwtAccessPayload): Promise<AccessToken> {
    const token = await this.jwtService.signAsync(payload);
    return { token, expiresIn: this.accessTtlSeconds };
  }

  /** Issues a fresh opaque refresh token bound to a session. */
  async issueRefreshToken(input: {
    userId: string;
    sessionId: string;
    context?: RequestContext;
  }): Promise<RefreshToken> {
    const token = this.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    await this.refreshTokens.create({
      userId: input.userId,
      sessionId: input.sessionId,
      tokenHash: this.hashToken(token),
      expiresAt,
      userAgent: input.context?.userAgent,
      ipAddress: input.context?.ipAddress,
    });
    return { token, expiresAt };
  }

  /**
   * Validates and rotates a presented refresh token.
   *
   * Reuse of an already-rotated/revoked token is treated as theft: the entire
   * session family is revoked and the session is invalidated, forcing re-login.
   */
  async rotateRefreshToken(input: {
    presentedToken: string;
    context?: RequestContext;
  }): Promise<RotationResult> {
    const record = await this.refreshTokens.findByHash(
      this.hashToken(input.presentedToken),
    );

    if (!record) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    // Automatic reuse detection (OWASP refresh-token rotation guidance).
    if (record.revokedAt || record.replacedById) {
      this.logger.warn(
        { userId: record.userId, sessionId: record.sessionId },
        'Refresh token reuse detected — revoking session family',
      );
      if (record.sessionId) {
        await this.refreshTokens.revokeAllForSession(record.sessionId);
        await this.sessions.revoke(record.sessionId);
      } else {
        await this.refreshTokens.revokeAllForUser(record.userId);
      }
      throw new UnauthorizedException('Refresh token has been revoked.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    if (!record.sessionId) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const rotated = this.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs);
    const created = await this.refreshTokens.create({
      userId: record.userId,
      sessionId: record.sessionId,
      tokenHash: this.hashToken(rotated),
      expiresAt,
      userAgent: input.context?.userAgent,
      ipAddress: input.context?.ipAddress,
    });
    await this.refreshTokens.markRotated(record.id, created.id);

    return {
      userId: record.userId,
      sessionId: record.sessionId,
      refresh: { token: rotated, expiresAt },
    };
  }

  /** SHA-256 hex hash. Safe for high-entropy tokens (no salt needed). */
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@infra/prisma/prisma.service';

import { RequestContext } from '../interfaces/auth-tokens.interface';

/** Canonical audit action names for authentication events. */
export enum AuthAuditAction {
  Register = 'auth.register',
  Login = 'auth.login',
  LoginFailed = 'auth.login_failed',
  Logout = 'auth.logout',
  LogoutAll = 'auth.logout_all',
  TokenRefreshed = 'auth.token_refreshed',
  RefreshReuseDetected = 'auth.refresh_reuse_detected',
  PasswordChanged = 'auth.password_changed',
  PasswordResetRequested = 'auth.password_reset_requested',
  PasswordReset = 'auth.password_reset',
  EmailVerified = 'auth.email_verified',
  SessionRevoked = 'auth.session_revoked',
}

/**
 * Writes append-only entries to the `AuditLog`.
 *
 * Auditing must never break the request it records, so failures are swallowed
 * and logged rather than propagated.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditService.name);
  }

  async record(input: {
    action: AuthAuditAction;
    userId?: string | null;
    metadata?: Prisma.InputJsonValue;
    context?: RequestContext;
  }): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          userId: input.userId ?? null,
          metadata: input.metadata,
          ipAddress: input.context?.ipAddress ?? null,
          userAgent: input.context?.userAgent ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        { err: error, action: input.action },
        'Failed to write audit log entry',
      );
    }
  }
}

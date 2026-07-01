import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Request } from 'express';

import { authConfig } from '@config/configuration';

/** Non-HttpOnly cookie carrying the CSRF token (readable by first-party JS). */
export const CSRF_COOKIE_NAME = 'csrf_token';
/** Header the client must echo the CSRF cookie value into. */
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Double-submit CSRF protection for cookie-borne refresh tokens.
 *
 * Only enforced when the request actually carries the refresh cookie — bearer/
 * body-based clients are not cookie-driven and are therefore CSRF-immune, so
 * the guard is a no-op for them. Combined with `SameSite=Lax`, this defends the
 * state-changing `/refresh` and `/logout` routes.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;

    const refreshCookie = cookies[this.config.cookie.name];
    if (!refreshCookie) {
      // Refresh token is not being supplied via cookie → CSRF not applicable.
      return true;
    }

    const csrfCookie = cookies[CSRF_COOKIE_NAME];
    const headerValue = req.headers[CSRF_HEADER_NAME];
    const csrfHeader = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid or missing CSRF token.');
    }

    return true;
  }
}

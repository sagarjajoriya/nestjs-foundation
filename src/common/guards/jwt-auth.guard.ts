import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';

/**
 * Access-token authentication guard.
 *
 * Delegates to the Passport `'jwt'` strategy, but first honors the `@Public()`
 * decorator so opted-out routes bypass authentication entirely.
 *
 * Intentionally NOT registered globally yet — the system is prepared for
 * enforcement, but endpoints remain public by default. Enabling enforcement is
 * a single `APP_GUARD` registration (see `src/common/guards/README.md`) that
 * requires no controller changes: routes already carry `@Public()` / `@Roles()`
 * metadata.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}

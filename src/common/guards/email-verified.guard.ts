import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { EMAIL_VERIFIED_KEY } from '@common/decorators/require-email-verified.decorator';
import { IS_PUBLIC_KEY } from '@common/decorators/public.decorator';
import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';

/**
 * Gates routes annotated with `@RequireEmailVerified()` behind a verified email
 * address. A no-op on routes that do not require verification, so it is safe to
 * apply broadly. Expected to run after authentication.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<boolean>(
      EMAIL_VERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'A verified email address is required to perform this action.',
      );
    }

    return true;
  }
}

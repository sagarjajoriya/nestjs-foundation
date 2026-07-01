import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';

/**
 * Extracts the authenticated principal (or one of its fields) from the request.
 *
 * `request.user` is populated by the authentication guard/strategy introduced in
 * the auth milestone. Until then the value is `undefined`; endpoints relying on
 * it should treat a missing user as unauthenticated.
 *
 * @example
 * ```ts
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 * getId(@CurrentUser('id') id: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (
    field: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext,
  ):
    | AuthenticatedUser
    | AuthenticatedUser[keyof AuthenticatedUser]
    | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return field ? user[field] : user;
  },
);

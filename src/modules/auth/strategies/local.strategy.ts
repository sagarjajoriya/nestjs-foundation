import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-local';

import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';

import { AuthService } from '../auth.service';
import { extractRequestContext } from '../utils/request-context.util';

/**
 * Email + password authentication for the login endpoint.
 *
 * `passReqToCallback` is enabled so the request context (IP / user-agent) is
 * available for lockout accounting and audit logging.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    email: string,
    password: string,
  ): Promise<AuthenticatedUser> {
    return this.authService.validateCredentials(
      email,
      password,
      extractRequestContext(req),
    );
  }
}

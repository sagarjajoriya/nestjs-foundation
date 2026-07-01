import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';
import { authConfig } from '@config/configuration';

import { VerifiedJwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Validates RS256 access tokens from the `Authorization: Bearer` header and
 * maps the verified claims onto the request principal (`request.user`).
 *
 * Verification uses only the public key, so this strategy could run in a
 * separate service without access to the signing key.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(authConfig.KEY)
    config: ConfigType<typeof authConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.publicKey,
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  }

  /** Passport assigns the return value to `request.user`. */
  validate(payload: VerifiedJwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
      sessionId: payload.sid,
      emailVerified: payload.emailVerified,
    };
  }
}

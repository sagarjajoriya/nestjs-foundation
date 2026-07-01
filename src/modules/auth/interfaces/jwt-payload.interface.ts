/**
 * Claims carried by an access token.
 *
 * Registered claims (`iss`, `aud`, `iat`, `exp`, `jti`) are added by the signer;
 * the fields below are the application-specific payload.
 */
export interface JwtAccessPayload {
  /** Subject — the user id. */
  sub: string;
  /** The user's email. */
  email: string;
  /** Role names granted to the user. */
  roles: string[];
  /** Session id this token belongs to (enables session-aware revocation). */
  sid: string;
  /** Whether the user's email is verified. */
  emailVerified: boolean;
}

/** Access token payload as returned by Passport after verification. */
export type VerifiedJwtPayload = JwtAccessPayload & {
  iat: number;
  exp: number;
  jti?: string;
};

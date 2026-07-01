/** An issued access token plus its lifetime. */
export interface AccessToken {
  token: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** An issued opaque refresh token plus its absolute expiry. */
export interface RefreshToken {
  token: string;
  expiresAt: Date;
}

/** Context captured for a session / refresh token (device fingerprint). */
export interface RequestContext {
  userAgent?: string;
  ipAddress?: string;
}

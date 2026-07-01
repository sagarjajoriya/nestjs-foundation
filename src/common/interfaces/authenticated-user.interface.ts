/**
 * The shape of the authenticated principal attached to `request.user`.
 *
 * Populated by the JWT strategy once authentication enforcement is enabled.
 * Consumers (`@CurrentUser()`, `RolesGuard`, `EmailVerifiedGuard`) depend on
 * this stable contract, so it is defined ahead of the strategy wiring.
 */
export interface AuthenticatedUser {
  /** The user's unique identifier (UUID). */
  id: string;
  /** The user's email address. */
  email: string;
  /** Role names granted to the user (e.g. `['ADMIN']`). */
  roles: string[];
  /**
   * The session this access token belongs to (JWT `sid` claim). Enables
   * session-aware operations (listing, targeted revocation).
   */
  sessionId?: string;
  /** Whether the user's email address has been verified. */
  emailVerified: boolean;
}

/**
 * The shape of the authenticated principal attached to a request once the
 * Phase 2 auth milestone lands (populated by the JWT strategy / auth guard).
 *
 * Declared now so services and the future `@CurrentUser()` decorator can depend
 * on a stable contract before authentication is implemented.
 */
export interface AuthenticatedUser {
  /** The user's unique identifier (UUID). */
  id: string;
  /** The user's email address. */
  email: string;
  /** Coarse-grained roles; the RBAC model is defined in Phase 2. */
  roles?: string[];
}

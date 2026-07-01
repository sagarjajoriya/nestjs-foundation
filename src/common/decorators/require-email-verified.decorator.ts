import { SetMetadata } from '@nestjs/common';

/** Metadata key flagging a route as requiring a verified email address. */
export const EMAIL_VERIFIED_KEY = 'requireEmailVerified';

/**
 * Requires the authenticated principal to have a verified email address.
 * Enforced by {@link EmailVerifiedGuard}.
 *
 * Records metadata only; it takes effect when the guard runs. Use to gate
 * sensitive actions (e.g. changing billing) behind email verification.
 *
 * @example
 * ```ts
 * @RequireEmailVerified()
 * @Post('billing')
 * updateBilling() { ... }
 * ```
 */
export const RequireEmailVerified = (): MethodDecorator & ClassDecorator =>
  SetMetadata(EMAIL_VERIFIED_KEY, true);

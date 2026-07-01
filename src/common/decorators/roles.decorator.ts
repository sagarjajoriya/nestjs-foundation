import { SetMetadata } from '@nestjs/common';

/** Metadata key under which required role names are stored. */
export const ROLES_KEY = 'requiredRoles';

/**
 * Restricts a route (or controller) to principals holding at least one of the
 * given roles. Enforced by {@link RolesGuard}.
 *
 * Attaching this decorator only records metadata; it has no effect until the
 * guard runs (either applied explicitly via `@UseGuards` or globally once
 * authentication enforcement is enabled).
 *
 * @example
 * ```ts
 * @Roles('ADMIN', 'SUPER_ADMIN')
 * @Delete(':id')
 * remove() { ... }
 * ```
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

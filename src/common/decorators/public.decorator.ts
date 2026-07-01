import { SetMetadata } from '@nestjs/common';

/** Metadata key used to flag a route as publicly accessible. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route (or controller) as public, exempting it from the global
 * authentication guard that will be introduced in the Phase 2 auth milestone.
 *
 * Defined now so route authors can annotate endpoints against a stable API
 * before the guard exists.
 *
 * @example
 * ```ts
 * @Public()
 * @Get('health')
 * check() { ... }
 * ```
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

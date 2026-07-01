import { Global, Module } from '@nestjs/common';

import { HashingService } from './hashing.service';

/**
 * Cross-cutting security primitives (hashing today; token/crypto helpers later).
 *
 * Marked `@Global` so any feature — users now, auth next — can inject
 * `HashingService` without re-importing this module.
 */
@Global()
@Module({
  providers: [HashingService],
  exports: [HashingService],
})
export class SecurityModule {}

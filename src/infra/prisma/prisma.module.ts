import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global database access module.
 *
 * Marked `@Global` so any feature module can inject `PrismaService` without
 * importing `PrismaModule` explicitly — the single, shared connection pool is
 * the correct default for a service of this shape.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

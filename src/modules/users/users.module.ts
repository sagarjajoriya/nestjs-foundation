import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * User feature module.
 *
 * `PrismaService` (global `PrismaModule`) and `HashingService` (global
 * `SecurityModule`) are injected without explicit imports. `UsersService` is
 * exported so the future auth module can reuse user lookups.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}

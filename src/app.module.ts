import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';

import { AllExceptionsFilter } from '@common/filters/all-exceptions.filter';
import { AppConfigModule } from '@config/config.module';
import { throttlerConfig } from '@config/configuration';
import { PrismaModule } from '@infra/prisma/prisma.module';
import { LoggerModule } from '@logger/logger.module';
import { AuthModule } from '@modules/auth/auth.module';
import { HealthModule } from '@modules/health/health.module';
import { UsersModule } from '@modules/users/users.module';
import { SecurityModule } from '@security/security.module';

/**
 * Root application module.
 *
 * Deliberately thin: it wires cross-cutting infrastructure (config, logging,
 * database, rate limiting, global exception handling) and mounts feature
 * modules. No business logic lives here.
 */
@Module({
  imports: [
    // Order matters: config first (others depend on it), then logging.
    AppConfigModule,
    LoggerModule,
    PrismaModule,
    SecurityModule,

    // Global rate limiting with sensible, un-fussy defaults.
    ThrottlerModule.forRootAsync({
      inject: [throttlerConfig.KEY],
      useFactory: (config: ConfigType<typeof throttlerConfig>) => ({
        throttlers: [
          {
            ttl: seconds(config.ttlSeconds),
            limit: config.limit,
          },
        ],
      }),
    }),

    // Feature modules.
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    // Apply the rate limiter to every route.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Single, consistent error envelope for every unhandled exception.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

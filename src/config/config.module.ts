import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { configurations } from './configuration';
import { validateEnv } from './env.validation';

/**
 * Global configuration module.
 *
 * Encapsulates all `@nestjs/config` wiring so the root module stays thin and
 * the validation/namespace strategy lives in one place. Marked `@Global` so
 * every feature module can inject configuration namespaces without re-importing.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Fail fast on invalid/missing environment variables at boot.
      validate: validateEnv,
      // Typed, namespaced configuration factories.
      load: configurations,
      // `.env` for local dev; real deployments inject env vars directly.
      envFilePath: ['.env'],
      expandVariables: true,
    }),
  ],
})
export class AppConfigModule {}

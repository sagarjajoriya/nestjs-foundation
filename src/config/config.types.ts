import { ConfigType } from '@nestjs/config';

import {
  appConfig,
  authConfig,
  databaseConfig,
  swaggerConfig,
  throttlerConfig,
} from './configuration';

/**
 * Inferred configuration types for ergonomic, type-safe injection, e.g.:
 *
 * ```ts
 * constructor(@Inject(appConfig.KEY) private readonly cfg: AppConfig) {}
 * ```
 */
export type AppConfig = ConfigType<typeof appConfig>;
export type DatabaseConfig = ConfigType<typeof databaseConfig>;
export type SwaggerConfig = ConfigType<typeof swaggerConfig>;
export type ThrottlerConfig = ConfigType<typeof throttlerConfig>;
export type AuthConfig = ConfigType<typeof authConfig>;

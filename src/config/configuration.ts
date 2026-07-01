import { registerAs } from '@nestjs/config';

import { NodeEnvironment } from './env.validation';

/**
 * Parses a comma-separated origin list into a clean string array.
 * `"http://a.com, http://b.com"` => `['http://a.com', 'http://b.com']`.
 */
const parseOrigins = (raw: string | undefined): string[] =>
  (raw ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const asBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (raw === undefined) {
    return fallback;
  }
  return ['true', '1', 'yes', 'on'].includes(raw.trim().toLowerCase());
};

const asInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Namespaced, strongly-typed configuration.
 *
 * Consumers inject a namespace via `@Inject(appConfig.KEY)` and receive a fully
 * typed object (`ConfigType<typeof appConfig>`) — no stringly-typed
 * `config.get('SOME.KEY')` lookups, no magic strings at call sites.
 *
 * Values are read from `process.env`, which has already been validated by
 * {@link validateEnv} before any of these factories run.
 */
export const appConfig = registerAs('app', () => ({
  nodeEnv:
    (process.env.NODE_ENV as NodeEnvironment) ?? NodeEnvironment.Development,
  isProduction: process.env.NODE_ENV === NodeEnvironment.Production,
  name: process.env.APP_NAME ?? 'nestjs-foundation',
  port: asInt(process.env.PORT, 3000),
  globalPrefix: process.env.API_GLOBAL_PREFIX ?? '',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  cors: {
    origins: parseOrigins(process.env.CORS_ORIGINS),
    credentials: asBoolean(process.env.CORS_CREDENTIALS, false),
  },
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
}));

export const swaggerConfig = registerAs('swagger', () => ({
  enabled: asBoolean(process.env.SWAGGER_ENABLED, true),
  path: process.env.SWAGGER_PATH ?? 'docs',
  title: `${process.env.APP_NAME ?? 'NestJS Foundation'} API`,
  description: 'Production-grade NestJS backend API.',
  version: '1.0',
}));

export const throttlerConfig = registerAs('throttler', () => ({
  ttlSeconds: asInt(process.env.THROTTLER_TTL_SECONDS, 60),
  limit: asInt(process.env.THROTTLER_LIMIT, 100),
}));

/**
 * Auth configuration is defined now so the module boundary is stable, but the
 * secrets are only *consumed* in the Phase 2 authentication milestone.
 */
export const authConfig = registerAs('auth', () => ({
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
}));

/** Convenience array for `ConfigModule.forRoot({ load })`. */
export const configurations = [
  appConfig,
  databaseConfig,
  swaggerConfig,
  throttlerConfig,
  authConfig,
];

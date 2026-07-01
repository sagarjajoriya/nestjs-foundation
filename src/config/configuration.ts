import { registerAs } from '@nestjs/config';

import { NodeEnvironment, RefreshTransport } from './env.validation';
import { resolveAccessKeys } from './jwt-keys';

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
 * Authentication configuration.
 *
 *  - Access tokens: RS256 (asymmetric). Keys are resolved once via
 *    {@link resolveAccessKeys} (env-provided PEM in prod, ephemeral in dev).
 *  - Refresh tokens: opaque, hashed at rest; transport is client-configurable.
 *  - Lockout + verification lifetimes are operator-tunable.
 */
export const authConfig = registerAs('auth', () => {
  const keys = resolveAccessKeys();
  const isProduction = process.env.NODE_ENV === NodeEnvironment.Production;

  return {
    jwt: {
      algorithm: 'RS256' as const,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      issuer: process.env.JWT_ISSUER ?? 'nestjs-foundation',
      audience: process.env.JWT_AUDIENCE ?? 'nestjs-foundation',
    },
    refresh: {
      ttl: process.env.REFRESH_TOKEN_TTL ?? '7d',
      transport:
        (process.env.AUTH_REFRESH_TRANSPORT as RefreshTransport) ??
        RefreshTransport.Both,
    },
    cookie: {
      name: 'refresh_token',
      // Scope the refresh cookie to the auth routes that consume it.
      path: '/v1/auth',
      domain: process.env.AUTH_COOKIE_DOMAIN,
      secure: isProduction,
      sameSite: 'lax' as const,
    },
    lockout: {
      maxFailedLogins: asInt(process.env.AUTH_MAX_FAILED_LOGINS, 5),
      lockoutMinutes: asInt(process.env.AUTH_LOCKOUT_MINUTES, 15),
    },
    verification: {
      emailTtlMinutes: asInt(process.env.EMAIL_VERIFICATION_TTL_MINUTES, 1440),
      passwordResetTtlMinutes: asInt(
        process.env.PASSWORD_RESET_TTL_MINUTES,
        60,
      ),
    },
    publicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3000',
  };
});

/** Convenience array for `ConfigModule.forRoot({ load })`. */
export const configurations = [
  appConfig,
  databaseConfig,
  swaggerConfig,
  throttlerConfig,
  authConfig,
];

import 'reflect-metadata';

/**
 * Runs before any test module is imported (via Jest `setupFiles`), so the
 * environment is valid by the time `AppModule` → `ConfigModule` performs its
 * fail-fast validation. The database itself is mocked in the e2e specs, so the
 * URL only needs to be syntactically present.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://user:pass@localhost:5432/test?schema=public';
process.env.SWAGGER_ENABLED = 'false';

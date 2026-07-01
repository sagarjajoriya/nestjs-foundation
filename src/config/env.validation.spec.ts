import { NodeEnvironment, validateEnv } from './env.validation';

describe('validateEnv', () => {
  const validBase = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  };

  it('accepts a valid configuration and applies defaults', () => {
    const result = validateEnv(validBase);

    expect(result.NODE_ENV).toBe(NodeEnvironment.Development);
    expect(result.PORT).toBe(3000);
    expect(result.THROTTLER_LIMIT).toBe(100);
    expect(result.SWAGGER_ENABLED).toBe(true);
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...validBase, NODE_ENV: 'banana' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('coerces boolean-like strings', () => {
    const result = validateEnv({ ...validBase, SWAGGER_ENABLED: 'false' });
    expect(result.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects a too-short JWT secret', () => {
    expect(() =>
      validateEnv({ ...validBase, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('treats an empty JWT secret as unset (Phase 1)', () => {
    const result = validateEnv({
      ...validBase,
      JWT_ACCESS_SECRET: '',
      JWT_REFRESH_SECRET: '   ',
    });
    expect(result.JWT_ACCESS_SECRET).toBeUndefined();
    expect(result.JWT_REFRESH_SECRET).toBeUndefined();
  });
});

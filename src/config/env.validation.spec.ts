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

  it('applies auth defaults (RS256 keys optional in non-production)', () => {
    const result = validateEnv(validBase);
    expect(result.AUTH_MAX_FAILED_LOGINS).toBe(5);
    expect(result.AUTH_LOCKOUT_MINUTES).toBe(15);
    expect(result.REFRESH_TOKEN_TTL).toBe('7d');
    expect(result.JWT_ACCESS_PRIVATE_KEY).toBeUndefined();
  });

  it('requires RS256 access keys in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('accepts production when RS256 access keys are provided', () => {
    const result = validateEnv({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      JWT_ACCESS_PRIVATE_KEY: 'cHJpdmF0ZQ==',
      JWT_ACCESS_PUBLIC_KEY: 'cHVibGlj',
    });
    expect(result.NODE_ENV).toBe(NodeEnvironment.Production);
  });

  it('rejects an invalid refresh transport', () => {
    expect(() =>
      validateEnv({ ...validBase, AUTH_REFRESH_TRANSPORT: 'carrier-pigeon' }),
    ).toThrow(/Invalid environment configuration/);
  });
});

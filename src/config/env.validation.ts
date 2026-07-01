import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Supported runtime environments.
 *
 * `staging` is included up-front so infra (logging verbosity, Swagger gating,
 * etc.) can branch on it without a later breaking change.
 */
export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Staging = 'staging',
  Production = 'production',
}

/**
 * Coerces common truthy/falsy string representations into a real boolean.
 * Env vars are always strings, so we normalize `"true"/"1"/"yes"` → true.
 */
const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return value;
};

/**
 * Normalizes an empty/whitespace-only env value to `undefined` so that
 * `@IsOptional()` treats it as "not set" (class-validator's `@IsOptional` only
 * skips `null`/`undefined`, not `""`). Applied to optional secrets that are
 * blank in `.env` during Phase 1.
 */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

/**
 * The single source of truth for every environment variable the app reads.
 *
 * The application boot is aborted (see {@link validateEnv}) if any value here
 * fails validation, so a misconfigured deployment fails fast and loudly rather
 * than surfacing subtle runtime bugs.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsString()
  @IsOptional()
  APP_NAME = 'nestjs-foundation';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  @IsOptional()
  API_GLOBAL_PREFIX = '';

  /** Comma-separated allowlist of CORS origins. Empty => same-origin only. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS = '';

  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  CORS_CREDENTIALS = false;

  @IsString()
  @IsOptional()
  LOG_LEVEL = 'info';

  // --- Database ---
  @IsString()
  @MinLength(1)
  DATABASE_URL!: string;

  // --- Swagger ---
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  SWAGGER_ENABLED = true;

  @IsString()
  @IsOptional()
  SWAGGER_PATH = 'docs';

  // --- Throttler ---
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLER_TTL_SECONDS = 60;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  THROTTLER_LIMIT = 100;

  // --- Auth (prepared for Phase 2; optional in Phase 1) ---
  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  @MinLength(16)
  JWT_ACCESS_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_TTL = '15m';

  @Transform(emptyToUndefined)
  @IsString()
  @IsOptional()
  @MinLength(16)
  JWT_REFRESH_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_TTL = '7d';
}

/**
 * Validation function handed to `ConfigModule.forRoot({ validate })`.
 *
 * Runs synchronously at process start. Any failure throws with an aggregated,
 * human-readable message so the deployment operator sees exactly what to fix.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .filter(Boolean)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}

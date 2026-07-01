import { Module } from '@nestjs/common';

/**
 * Authentication module — Phase 2 placeholder.
 *
 * Intentionally empty in Phase 1. The module boundary and import path exist now
 * so the future implementation (Passport JWT strategy, Argon2 password hashing,
 * access/refresh token rotation, login/registration endpoints) can be added
 * without touching the root module wiring.
 *
 * The required dependencies (`@nestjs/passport`, `passport-jwt`, `@nestjs/jwt`,
 * `argon2`) are already installed, and `authConfig` already exposes the JWT
 * settings this module will consume.
 */
@Module({})
export class AuthModule {}

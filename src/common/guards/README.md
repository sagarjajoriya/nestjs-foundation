# Guards

Shared, cross-cutting authentication/authorization guards.

## Available guards

- **`JwtAuthGuard`** — validates the access token via the Passport `'jwt'`
  strategy and populates `request.user` (see `AuthenticatedUser`). Honors the
  `@Public()` decorator to opt routes out.
- **`RolesGuard`** — enforces role requirements declared with `@Roles(...)`.
  No-op when a route declares no roles.
- **`EmailVerifiedGuard`** — enforces `@RequireEmailVerified()`. No-op
  otherwise.

`RolesGuard` and `EmailVerifiedGuard` assume authentication has already run
(they read `request.user`), so when enabling global enforcement, register them
**after** `JwtAuthGuard`.

## Enforcement is currently OFF (public by default)

These guards are **built but not registered globally**. Every endpoint remains
publicly accessible; the metadata (`@Public`, `@Roles`, `@RequireEmailVerified`)
is inert until a guard runs.

### Enabling enforcement (no controller changes required)

Because routes are already annotated with their intended access metadata,
turning on enforcement is a one-time edit to `src/app.module.ts` — add the
guards as `APP_GUARD` providers (order matters: authenticate first):

```ts
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { EmailVerifiedGuard } from '@common/guards/email-verified.guard';

providers: [
  // ...existing providers
  { provide: APP_GUARD, useClass: JwtAuthGuard }, // 1. authenticate
  { provide: APP_GUARD, useClass: RolesGuard }, // 2. authorize (roles)
  { provide: APP_GUARD, useClass: EmailVerifiedGuard }, // 3. gate unverified
];
```

Prerequisite: the `'jwt'` Passport strategy must be registered (auth module)
before `JwtAuthGuard` is enabled globally, otherwise every non-`@Public` route
returns 401. Until then, apply guards per-route with `@UseGuards(...)` on the
specific endpoints that require an authenticated principal.

# Guards

Shared, cross-cutting guards live here.

**Phase 1 (current):** intentionally empty — this folder reserves the location
and import path for the authentication/authorization guards.

**Phase 2 (auth milestone):** will add, at minimum:

- `JwtAuthGuard` — validates the access token and populates
  `request.user` (see `AuthenticatedUser`). Applied globally, with the
  `@Public()` decorator (`src/common/decorators/public.decorator.ts`) opting
  routes out.
- `RolesGuard` — enforces RBAC using role metadata.

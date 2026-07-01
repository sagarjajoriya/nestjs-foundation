# NestJS Foundation

Production-grade NestJS backend scaffold — the shared foundation for multiple
SaaS/enterprise services.

**Delivered so far:**

- **Phase 1 — Infrastructure:** config, logging, security headers, versioning,
  Swagger, global exception handling, tooling.
- **Phase 2 — Database & Prisma:** full RBAC + authentication data model
  (User, Role, Permission, join tables, OAuthAccount, Session, RefreshToken,
  AuditLog), migrations, and an idempotent seed.
- **Phase 3 — User module:** CRUD, search, pagination, filtering, soft delete,
  restore, and profile (`/me`) endpoints.

Authentication (login/refresh flows, JWT guards, RBAC **enforcement**) is the
next milestone — the seams for it already exist.

## Stack

NestJS 11 · TypeScript 6 (strict) · Prisma 7 (driver adapters) · PostgreSQL ·
Argon2 · class-validator · Pino · Swagger · Throttler · Helmet · ESLint 10 ·
Prettier · Husky · Jest 30 · pnpm · SWC.

## Requirements

- Node.js 20.19+ / 22.12+ / 24+ (Prisma 7 requirement)
- pnpm 10+
- PostgreSQL 14+

## Getting started

```bash
pnpm install
cp .env.example .env            # then edit DATABASE_URL (and SEED_ADMIN_* if seeding)
pnpm prisma:generate
pnpm prisma:migrate             # applies the schema
pnpm db:seed                    # permissions, roles, and a SUPER_ADMIN admin
pnpm start:dev
```

- API base: `http://localhost:3000/v1`
- Health: `GET /v1/health` (liveness), `GET /v1/health/ready` (readiness + DB)
- Swagger UI: `http://localhost:3000/docs`

## Scripts

| Script                                       | Purpose                                   |
| -------------------------------------------- | ----------------------------------------- |
| `pnpm start:dev`                             | Watch-mode dev server                     |
| `pnpm build`                                 | Production build (SWC, output in `dist/`) |
| `pnpm start:prod`                            | Run the compiled build                    |
| `pnpm typecheck`                             | Type-check only (`tsc --noEmit`)          |
| `pnpm lint` / `pnpm format`                  | Lint / format                             |
| `pnpm test` / `pnpm test:e2e`                | Unit / e2e tests                          |
| `pnpm prisma:migrate` / `pnpm prisma:studio` | Prisma migrate / Studio                   |
| `pnpm db:seed`                               | Seed the database                         |

## Architecture

```
src/
├─ main.ts            # bootstrap: pino, helmet, cors, versioning, pipes, swagger
├─ app.module.ts      # root wiring (config, logging, prisma, security, throttler)
├─ config/            # typed, validated, namespaced configuration
├─ common/            # cross-cutting: filters, decorators, dto, validators, guards
├─ infra/prisma/      # PrismaModule + PrismaService (global)
├─ logger/            # Pino logging module
├─ security/          # SecurityModule + HashingService (Argon2id, global)
└─ modules/
   ├─ health/         # /v1/health (liveness + DB readiness)
   ├─ users/          # /v1/users — controller, service, repository, dto, entities
   └─ auth/           # placeholder for the authentication milestone
```

Principles: thin controllers, rich services, repository pattern for the core
aggregate, feature-based modules, DI everywhere, one consistent error envelope,
fail-fast env validation, structured logs with a per-request correlation id
(`x-request-id`).

## Data model (RBAC + auth)

UUID primary keys, snake_case columns, timestamps, indexes/FKs with deliberate
cascade rules. Highlights:

- **User** — soft delete (`deletedAt`) with a **partial unique index** on
  `email` (`WHERE deleted_at IS NULL`), so a deleted user's email can be reused.
  Look users up via `findFirst({ email, deletedAt: null })`, not `findUnique`.
- **Role / Permission** + `UserRole` / `RolePermission` join tables.
- **OAuthAccount / Session / RefreshToken** — refresh tokens stored as SHA-256
  hashes with a rotation self-relation for reuse detection.
- **AuditLog** — append-only; `userId` is `SetNull` to preserve the trail.

Seed data: 9 permissions; roles `SUPER_ADMIN` (all), `ADMIN` (7), `USER`
(`users.read`, `projects.read`); one Argon2id-hashed `SUPER_ADMIN` admin
(`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`, required in production).

## API — Users (`/v1/users`)

| Method   | Path                 | Description                                           |
| -------- | -------------------- | ----------------------------------------------------- |
| `POST`   | `/users`             | Create user (admin/bootstrap; hashes password)        |
| `GET`    | `/users`             | List: `search`, `isActive`, `deleted`, sort, paginate |
| `GET`    | `/users/me`          | Current user's profile                                |
| `PATCH`  | `/users/me`          | Update own profile (name)                             |
| `GET`    | `/users/:id`         | Get a user                                            |
| `PATCH`  | `/users/:id`         | Update a user (admin)                                 |
| `DELETE` | `/users/:id`         | Soft delete (`204`)                                   |
| `POST`   | `/users/:id/restore` | Restore a soft-deleted user                           |

Responses never include `passwordHash`. Password and email changes are excluded
from generic update/profile endpoints (reserved for dedicated auth flows).

> **Note:** these endpoints are currently **unauthenticated** — authorization
> (`JwtAuthGuard` + `@RequirePermissions()` RBAC) lands in the auth milestone.
> The `@CurrentUser()` seam and controller shape are ready for it.

## Configuration

All environment variables are declared, defaulted and validated in
`src/config/env.validation.ts`. The app **refuses to boot** on invalid config.
See `.env.example` for the full list.

## Testing

`pnpm test` (unit) and `pnpm test:e2e`. Unit tests mock the database, so no
running Postgres is required.

## Next milestone — Authentication

Passport JWT strategy, login/registration, Argon2 verification, access/refresh
token rotation, global `JwtAuthGuard` with `@Public()` opt-out, and
`@RequirePermissions()` RBAC enforcement wired onto the existing endpoints.

# NestJS Foundation

Production-grade NestJS backend scaffold — the shared foundation for multiple
SaaS/enterprise services.

**Phase 1 (this repo): infrastructure & architecture only.** No business logic.
Authentication (Passport/JWT/Argon2) is intentionally deferred to Phase 2; the
seams for it already exist.

## Stack

NestJS 11 · TypeScript 6 (strict) · Prisma 7 (driver adapters) · PostgreSQL ·
Pino · Swagger · Throttler · Helmet · ESLint 10 · Prettier · Husky · Jest 30 ·
pnpm.

## Requirements

- Node.js 20.19+ / 22.12+ / 24+ (Prisma 7 requirement)
- pnpm 10+
- PostgreSQL 14+

## Getting started

```bash
pnpm install
cp .env.example .env            # then edit DATABASE_URL
pnpm prisma:generate
pnpm prisma:migrate             # creates the users table
pnpm db:seed                    # optional demo row
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
├─ app.module.ts      # root wiring (config, logging, prisma, throttler, filters)
├─ config/            # typed, validated, namespaced configuration
├─ common/            # filters, decorators, guards, interfaces (cross-cutting)
├─ infra/prisma/      # PrismaModule + PrismaService (global)
├─ logger/            # Pino logging module
└─ modules/           # feature modules (health; auth placeholder for Phase 2)
```

Principles: thin controllers, rich services, feature-based modules, DI
everywhere, one consistent error envelope, fail-fast env validation, structured
logs with a per-request correlation id (`x-request-id`).

## Configuration

All environment variables are declared, defaulted and validated in
`src/config/env.validation.ts`. The app **refuses to boot** on invalid config.
See `.env.example` for the full list.

## Phase 2 (next milestone)

Authentication: Passport JWT strategy, Argon2 password hashing, access/refresh
token rotation, `JwtAuthGuard` (global) + `@Public()` opt-out, RBAC, and the
deferred Prisma models (Role, Permission, Session, RefreshToken, AuditLog, …).

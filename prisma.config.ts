import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * As of Prisma 7 the connection URL lives here (and/or is passed to the
 * `PrismaClient` via a driver adapter) rather than in `schema.prisma`. The CLI
 * (`migrate`, `db push`, `studio`) reads the datasource URL from this file.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});

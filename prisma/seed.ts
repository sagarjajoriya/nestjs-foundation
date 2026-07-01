import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Idempotent database seed.
 *
 * Uses `upsert` so it can be run repeatedly (locally and in CI) without
 * creating duplicates. Phase 1 seeds a single demo user; richer seeding
 * (roles, permissions) arrives with the auth milestone.
 */
async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const demoEmail = 'demo@example.com';
    const user = await prisma.user.upsert({
      where: { email: demoEmail },
      update: {},
      create: { email: demoEmail },
    });

    console.log(`Seed complete. Demo user id: ${user.id}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

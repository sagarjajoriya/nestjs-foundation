import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Database seed — Phase 2 (RBAC + bootstrap administrator).
 *
 * Fully idempotent: safe to run repeatedly in local dev and CI. Every entity is
 * upserted, and role→permission links are reconciled on each run.
 */

// Canonical permission catalogue.
const PERMISSIONS: ReadonlyArray<{ key: string; description: string }> = [
  { key: 'users.read', description: 'View users' },
  { key: 'users.create', description: 'Create users' },
  { key: 'users.update', description: 'Update users' },
  { key: 'users.delete', description: 'Delete users' },
  { key: 'roles.read', description: 'View roles' },
  { key: 'roles.manage', description: 'Create, update and delete roles' },
  { key: 'projects.read', description: 'View projects' },
  { key: 'projects.write', description: 'Create and modify projects' },
  { key: 'billing.manage', description: 'Manage billing and subscriptions' },
];

// Built-in roles and the permission keys granted to each.
const ROLES: ReadonlyArray<{
  name: string;
  description: string;
  permissions: readonly string[];
}> = [
  {
    name: 'SUPER_ADMIN',
    description: 'Unrestricted access to every capability.',
    permissions: PERMISSIONS.map((p) => p.key), // all permissions
  },
  {
    name: 'ADMIN',
    description: 'Administrative access without billing or role management.',
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'users.delete',
      'roles.read',
      'projects.read',
      'projects.write',
    ],
  },
  {
    name: 'USER',
    description: 'Baseline authenticated user.',
    permissions: ['users.read', 'projects.read'],
  },
];

/** Resolves the bootstrap admin credentials, enforcing safety in production. */
function resolveAdminCredentials(): { email: string; password: string } {
  const isProduction = process.env.NODE_ENV === 'production';
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (isProduction && (!email || !password)) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required when NODE_ENV=production.',
    );
  }

  const resolvedEmail = email ?? 'admin@example.com';
  const resolvedPassword = password ?? 'ChangeMe_Dev_123!';

  if (!password) {
    console.warn(
      '[seed] WARNING: using the insecure development default admin password. ' +
        'Set SEED_ADMIN_PASSWORD for any shared environment.',
    );
  }
  if (resolvedPassword.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 12 characters.');
  }

  return { email: resolvedEmail, password: resolvedPassword };
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the seed.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1) Permissions.
    const permissionIdByKey = new Map<string, string>();
    for (const permission of PERMISSIONS) {
      const record = await prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      });
      permissionIdByKey.set(record.key, record.id);
    }

    // 2) Roles + their permission grants (reconciled each run).
    const roleIdByName = new Map<string, string>();
    for (const role of ROLES) {
      const record = await prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description, isSystem: true },
        create: {
          name: role.name,
          description: role.description,
          isSystem: true,
        },
      });
      roleIdByName.set(record.name, record.id);

      for (const key of role.permissions) {
        const permissionId = permissionIdByKey.get(key);
        if (!permissionId) {
          throw new Error(
            `Unknown permission "${key}" for role "${role.name}".`,
          );
        }
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: record.id, permissionId },
          },
          update: {},
          create: { roleId: record.id, permissionId },
        });
      }
    }

    // 3) Bootstrap administrator (Argon2id password hash).
    const { email, password } = resolveAdminCredentials();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    // `email` is not a Prisma-unique field (partial unique index), so upsert by
    // a lookup among active users.
    const existingAdmin = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    const admin = existingAdmin
      ? await prisma.user.update({
          where: { id: existingAdmin.id },
          data: {
            passwordHash,
            name: 'Super Administrator',
            isActive: true,
            emailVerifiedAt: existingAdmin.emailVerifiedAt ?? new Date(),
          },
        })
      : await prisma.user.create({
          data: {
            email,
            passwordHash,
            name: 'Super Administrator',
            isActive: true,
            emailVerifiedAt: new Date(),
          },
        });

    // 4) Grant the administrator the SUPER_ADMIN role (system assignment).
    const superAdminRoleId = roleIdByName.get('SUPER_ADMIN');
    if (!superAdminRoleId) {
      throw new Error('SUPER_ADMIN role was not seeded.');
    }
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: admin.id, roleId: superAdminRoleId },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: superAdminRoleId,
        assignedById: null,
      },
    });

    console.log(
      `Seed complete: ${PERMISSIONS.length} permissions, ${ROLES.length} roles, ` +
        `admin <${admin.email}> (id: ${admin.id}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});

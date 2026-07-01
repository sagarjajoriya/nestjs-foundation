import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

import { PrismaService } from '@infra/prisma/prisma.service';

import {
  DeletedFilter,
  SortDirection,
  UserSortField,
} from './dto/list-users-query.dto';

/** Structured inputs for a paginated user query. */
export interface FindUsersParams {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
  deleted: DeletedFilter;
  sortBy: UserSortField;
  sortOrder: SortDirection;
}

/** Prisma include that eager-loads a user's roles. */
const USER_WITH_ROLES_INCLUDE = {
  userRoles: { include: { role: true } },
} satisfies Prisma.UserInclude;

/** A `User` with its roles eager-loaded — the shape auth needs. */
export type UserWithRoles = Prisma.UserGetPayload<{
  include: typeof USER_WITH_ROLES_INCLUDE;
}>;

/**
 * Data-access layer for the `User` aggregate.
 *
 * All Prisma access for users flows through here. It owns two rules the rest of
 * the app must not re-derive:
 *  - default exclusion of soft-deleted rows (`deletedAt: null`);
 *  - email lookups go via `findFirst` scoped to active rows, because `email`
 *    is enforced by a PARTIAL unique index and is therefore not a Prisma
 *    `@unique` field.
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds an active (non-deleted) user by email, or `null`. */
  findActiveByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { email, deletedAt: null } });
  }

  /** Finds an active user by email with roles eager-loaded (for auth). */
  findActiveByEmailWithRoles(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  /** Finds an active user by id with roles eager-loaded (for auth). */
  findActiveByIdWithRoles(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: USER_WITH_ROLES_INCLUDE,
    });
  }

  /**
   * Atomically creates a user and assigns a role by name, returning the user
   * with roles. Throws if the role does not exist (misconfigured seed).
   */
  createWithRole(
    data: { email: string; passwordHash: string | null; name: string | null },
    roleName: string,
  ): Promise<UserWithRoles> {
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({ where: { name: roleName } });
      if (!role) {
        throw new Error(`Default role "${roleName}" is not seeded.`);
      }
      return tx.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
          name: data.name,
          userRoles: { create: { roleId: role.id } },
        },
        include: USER_WITH_ROLES_INCLUDE,
      });
    });
  }

  /** Increments the failed-login counter and returns the updated user. */
  incrementFailedLoginCount(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: { increment: 1 } },
    });
  }

  /** Sets (or clears) the lockout expiry. */
  setLockout(id: string, lockedUntil: Date | null): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { lockedUntil } });
  }

  /** Resets login state after a successful login. */
  async recordSuccessfulLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  /** Updates the password hash. */
  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /** Marks the user's email as verified (idempotent — keeps the first time). */
  async markEmailVerified(id: string, when: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerifiedAt: when },
    });
  }

  /** Finds a user by id. Excludes soft-deleted rows unless asked to include. */
  findById(id: string, includeDeleted = false): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { id, ...(includeDeleted ? {} : { deletedAt: null }) },
    });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  softDelete(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  restore(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /** Returns a page of users plus the total matching count, in one round-trip. */
  async findManyAndCount(
    params: FindUsersParams,
  ): Promise<{ items: User[]; total: number }> {
    const where = this.buildWhere(params);
    const orderBy = {
      [params.sortBy]: params.sortOrder,
    } as Prisma.UserOrderByWithRelationInput;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  private buildWhere(params: FindUsersParams): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (params.deleted === DeletedFilter.Exclude) {
      where.deletedAt = null;
    } else if (params.deleted === DeletedFilter.Only) {
      where.deletedAt = { not: null };
    }

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params.search) {
      where.OR = [
        {
          email: {
            contains: params.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          name: { contains: params.search, mode: Prisma.QueryMode.insensitive },
        },
      ];
    }

    return where;
  }
}

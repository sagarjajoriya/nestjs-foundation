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

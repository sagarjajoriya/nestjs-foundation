import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';

import { PaginatedResponseDto } from '@common/dto/paginated-response.dto';
import { HashingService } from '@security/hashing.service';

import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './users.repository';

/**
 * User business logic. Controllers stay thin; all rules (uniqueness, hashing,
 * soft-delete/restore semantics, entity mapping) live here.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly hashingService: HashingService,
  ) {}

  /** Creates a user with a hashed password (admin/bootstrap endpoint). */
  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.usersRepository.findActiveByEmail(dto.email);
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await this.hashingService.hash(dto.password);
    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name ?? null,
    });

    return new UserEntity(user);
  }

  /** Returns a paginated, filtered, sorted list of users. */
  async findAll(
    query: ListUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserEntity>> {
    const { items, total } = await this.usersRepository.findManyAndCount({
      page: query.page,
      limit: query.limit,
      search: query.search,
      isActive: query.isActive,
      deleted: query.deleted,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return new PaginatedResponseDto(
      items.map((user) => new UserEntity(user)),
      total,
      query.page,
      query.limit,
    );
  }

  /** Returns a single active user or throws 404. */
  async findOne(id: string): Promise<UserEntity> {
    return new UserEntity(await this.getActiveOrFail(id));
  }

  /** Updates administrative fields, guarding email uniqueness. */
  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    await this.getActiveOrFail(id);

    if (dto.email) {
      const emailOwner = await this.usersRepository.findActiveByEmail(
        dto.email,
      );
      if (emailOwner && emailOwner.id !== id) {
        throw new ConflictException('A user with this email already exists.');
      }
    }

    const user = await this.usersRepository.update(id, {
      email: dto.email,
      name: dto.name,
      isActive: dto.isActive,
    });

    return new UserEntity(user);
  }

  /** Soft-deletes a user (idempotent from the caller's perspective). */
  async remove(id: string): Promise<void> {
    await this.getActiveOrFail(id);
    await this.usersRepository.softDelete(id);
  }

  /**
   * Restores a soft-deleted user. Fails with 409 if the email has since been
   * claimed by another active user (which would violate the partial unique
   * index).
   */
  async restore(id: string): Promise<UserEntity> {
    const user = await this.usersRepository.findById(id, true);
    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }
    if (!user.deletedAt) {
      throw new ConflictException('User is not deleted.');
    }

    const emailOwner = await this.usersRepository.findActiveByEmail(user.email);
    if (emailOwner) {
      throw new ConflictException(
        'Cannot restore: the email is now in use by an active user.',
      );
    }

    return new UserEntity(await this.usersRepository.restore(id));
  }

  /** Current user's profile. */
  async getProfile(userId: string): Promise<UserEntity> {
    return this.findOne(userId);
  }

  /** Current user updates their own (non-sensitive) profile fields. */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    await this.getActiveOrFail(userId);
    const user = await this.usersRepository.update(userId, { name: dto.name });
    return new UserEntity(user);
  }

  /** Loads an active user or throws a 404. */
  private async getActiveOrFail(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} was not found.`);
    }
    return user;
  }
}

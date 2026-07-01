import { ConflictException, NotFoundException } from '@nestjs/common';
import type { User } from '@prisma/client';

import { HashingService } from '@security/hashing.service';

import {
  DeletedFilter,
  SortDirection,
  UserSortField,
} from './dto/list-users-query.dto';
import { UserEntity } from './entities/user.entity';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'stored-hash',
  name: null,
  isActive: true,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<
    Pick<
      UsersRepository,
      | 'findActiveByEmail'
      | 'findById'
      | 'create'
      | 'update'
      | 'softDelete'
      | 'restore'
      | 'findManyAndCount'
    >
  >;
  let hashing: jest.Mocked<Pick<HashingService, 'hash' | 'verify'>>;

  beforeEach(() => {
    repo = {
      findActiveByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      findManyAndCount: jest.fn(),
    };
    hashing = { hash: jest.fn(), verify: jest.fn() };
    service = new UsersService(
      repo as unknown as UsersRepository,
      hashing as unknown as HashingService,
    );
  });

  describe('create', () => {
    it('hashes the password, persists, and returns an entity without the hash', async () => {
      repo.findActiveByEmail.mockResolvedValue(null);
      hashing.hash.mockResolvedValue('hashed-pw');
      repo.create.mockResolvedValue(makeUser({ email: 'new@example.com' }));

      const result = await service.create({
        email: 'new@example.com',
        password: 'Str0ng!Passw0rd',
      });

      expect(hashing.hash).toHaveBeenCalledWith('Str0ng!Passw0rd');
      expect(repo.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        passwordHash: 'hashed-pw',
        name: null,
      });
      expect(result).toBeInstanceOf(UserEntity);
      expect(
        (result as unknown as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
    });

    it('rejects a duplicate active email with 409', async () => {
      repo.findActiveByEmail.mockResolvedValue(makeUser());

      await expect(
        service.create({
          email: 'user@example.com',
          password: 'Str0ng!Passw0rd',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the entity when found', async () => {
      repo.findById.mockResolvedValue(makeUser());
      await expect(service.findOne('user-1')).resolves.toBeInstanceOf(
        UserEntity,
      );
    });

    it('throws 404 when missing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('rejects an email already owned by another active user', async () => {
      repo.findById.mockResolvedValue(makeUser({ id: 'user-1' }));
      repo.findActiveByEmail.mockResolvedValue(makeUser({ id: 'user-2' }));

      await expect(
        service.update('user-1', { email: 'taken@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('updates when the email belongs to the same user', async () => {
      repo.findById.mockResolvedValue(makeUser({ id: 'user-1' }));
      repo.findActiveByEmail.mockResolvedValue(makeUser({ id: 'user-1' }));
      repo.update.mockResolvedValue(
        makeUser({ id: 'user-1', name: 'Renamed' }),
      );

      const result = await service.update('user-1', {
        email: 'user@example.com',
        name: 'Renamed',
      });

      expect(repo.update).toHaveBeenCalledWith('user-1', {
        email: 'user@example.com',
        name: 'Renamed',
        isActive: undefined,
      });
      expect(result.name).toBe('Renamed');
    });
  });

  describe('remove', () => {
    it('soft-deletes an existing user', async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.softDelete.mockResolvedValue(makeUser({ deletedAt: new Date() }));

      await service.remove('user-1');
      expect(repo.softDelete).toHaveBeenCalledWith('user-1');
    });

    it('throws 404 for a missing user', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('restore', () => {
    it('restores a soft-deleted user when the email is free', async () => {
      repo.findById.mockResolvedValue(makeUser({ deletedAt: new Date() }));
      repo.findActiveByEmail.mockResolvedValue(null);
      repo.restore.mockResolvedValue(makeUser({ deletedAt: null }));

      const result = await service.restore('user-1');
      expect(repo.restore).toHaveBeenCalledWith('user-1');
      expect(result.deletedAt).toBeNull();
    });

    it('rejects restoring a user that is not deleted', async () => {
      repo.findById.mockResolvedValue(makeUser({ deletedAt: null }));
      await expect(service.restore('user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects restore when the email is now taken by an active user', async () => {
      repo.findById.mockResolvedValue(
        makeUser({ id: 'user-1', deletedAt: new Date() }),
      );
      repo.findActiveByEmail.mockResolvedValue(makeUser({ id: 'user-2' }));

      await expect(service.restore('user-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repo.restore).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('maps items to entities and computes pagination meta', async () => {
      repo.findManyAndCount.mockResolvedValue({
        items: [makeUser({ id: 'a' }), makeUser({ id: 'b' })],
        total: 25,
      });

      const result = await service.findAll({
        page: 2,
        limit: 10,
        sortBy: UserSortField.CreatedAt,
        sortOrder: SortDirection.Desc,
        deleted: DeletedFilter.Exclude,
      });

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toBeInstanceOf(UserEntity);
      expect(result.meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });
  });

  describe('updateProfile', () => {
    it('updates only the name of an existing user', async () => {
      repo.findById.mockResolvedValue(makeUser());
      repo.update.mockResolvedValue(makeUser({ name: 'New Name' }));

      const result = await service.updateProfile('user-1', {
        name: 'New Name',
      });
      expect(repo.update).toHaveBeenCalledWith('user-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });
});

import { UnauthorizedException } from '@nestjs/common';

import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';

import {
  DeletedFilter,
  SortDirection,
  UserSortField,
} from './dto/list-users-query.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<
    Pick<
      UsersService,
      | 'create'
      | 'findAll'
      | 'findOne'
      | 'update'
      | 'remove'
      | 'restore'
      | 'getProfile'
      | 'updateProfile'
    >
  >;

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'user@example.com',
  };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      restore: jest.fn(),
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };
    controller = new UsersController(service as unknown as UsersService);
  });

  it('delegates create to the service', async () => {
    const dto = { email: 'a@b.com', password: 'Str0ng!Passw0rd' };
    await controller.create(dto);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('delegates list to the service', async () => {
    const query = {
      page: 1,
      limit: 20,
      sortBy: UserSortField.CreatedAt,
      sortOrder: SortDirection.Desc,
      deleted: DeletedFilter.Exclude,
    };
    await controller.findAll(query);
    expect(service.findAll).toHaveBeenCalledWith(query);
  });

  it('resolves the profile from the current user', async () => {
    await controller.getProfile(currentUser);
    expect(service.getProfile).toHaveBeenCalledWith('user-1');
  });

  it('rejects profile access without an authenticated user', () => {
    // `requireUser` throws synchronously before the service is reached.
    expect(() => controller.getProfile(undefined)).toThrow(
      UnauthorizedException,
    );
    expect(service.getProfile).not.toHaveBeenCalled();
  });

  it('updates the profile for the current user', async () => {
    await controller.updateProfile(currentUser, { name: 'New' });
    expect(service.updateProfile).toHaveBeenCalledWith('user-1', {
      name: 'New',
    });
  });

  it('delegates findOne / update / remove / restore', async () => {
    await controller.findOne('id-1');
    expect(service.findOne).toHaveBeenCalledWith('id-1');

    await controller.update('id-1', { name: 'X' });
    expect(service.update).toHaveBeenCalledWith('id-1', { name: 'X' });

    await controller.remove('id-1');
    expect(service.remove).toHaveBeenCalledWith('id-1');

    await controller.restore('id-1');
    expect(service.restore).toHaveBeenCalledWith('id-1');
  });
});

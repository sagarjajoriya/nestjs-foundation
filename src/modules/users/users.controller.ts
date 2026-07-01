import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginatedResponse } from '@common/decorators/api-paginated-response.decorator';
import { PaginatedResponseDto } from '@common/dto/paginated-response.dto';
import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';

import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserEntity } from './entities/user.entity';
import { UsersService } from './users.service';

/**
 * User endpoints under `/v1/users`. Thin by design — every handler delegates to
 * {@link UsersService}.
 *
 * Authorization (a global `JwtAuthGuard` + `@RequirePermissions()` RBAC guard)
 * is added in the auth milestone; the handlers and `@CurrentUser()` seam are
 * shaped so those guards drop in without changes here.
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a user (admin/bootstrap).' })
  @ApiCreatedResponse({ type: UserEntity })
  @ApiConflictResponse({ description: 'Email already in use.' })
  create(@Body() dto: CreateUserDto): Promise<UserEntity> {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List users (search, filter, sort, paginate).' })
  @ApiPaginatedResponse(UserEntity)
  findAll(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResponseDto<UserEntity>> {
    return this.usersService.findAll(query);
  }

  // Declared before ':id' so it is not captured by the param route.
  @Get('me')
  @ApiOperation({ summary: "Get the current user's profile." })
  @ApiOkResponse({ type: UserEntity })
  getProfile(
    @CurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<UserEntity> {
    return this.usersService.getProfile(this.requireUser(user).id);
  }

  @Patch('me')
  @ApiOperation({ summary: "Update the current user's profile." })
  @ApiOkResponse({ type: UserEntity })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserEntity> {
    return this.usersService.updateProfile(this.requireUser(user).id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by id.' })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserEntity> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (admin).' })
  @ApiOkResponse({ type: UserEntity })
  @ApiNotFoundResponse({ description: 'User not found.' })
  @ApiConflictResponse({ description: 'Email already in use.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserEntity> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a user.' })
  @ApiNoContentResponse({ description: 'User soft-deleted.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  @Post(':id/restore')
  @ApiOperation({ summary: 'Restore a soft-deleted user.' })
  @ApiOkResponse({ type: UserEntity })
  @ApiConflictResponse({ description: 'Email now used by an active user.' })
  restore(@Param('id', ParseUUIDPipe) id: string): Promise<UserEntity> {
    return this.usersService.restore(id);
  }

  /**
   * Guards `/me` handlers against a missing principal. Once the auth guard is in
   * place `request.user` is always present; until then this yields a clean 401
   * instead of a 500.
   */
  private requireUser(user: AuthenticatedUser | undefined): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException('Authentication is required.');
    }
    return user;
  }
}

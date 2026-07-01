import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { PaginationQueryDto } from '@common/dto/pagination-query.dto';

/** Sortable fields for the user list. */
export enum UserSortField {
  CreatedAt = 'createdAt',
  Email = 'email',
  Name = 'name',
}

export enum SortDirection {
  Asc = 'asc',
  Desc = 'desc',
}

/** Controls whether soft-deleted users are included in the list. */
export enum DeletedFilter {
  Exclude = 'exclude',
  Include = 'include',
  Only = 'only',
}

/** Normalizes a boolean-like query string (`"true"`/`"false"`) to a boolean. */
const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return value;
};

/**
 * Query parameters for `GET /users`: pagination + search + filtering + sorting.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive match against email and name.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active state.' })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: UserSortField,
    default: UserSortField.CreatedAt,
  })
  @IsOptional()
  @IsEnum(UserSortField)
  sortBy: UserSortField = UserSortField.CreatedAt;

  @ApiPropertyOptional({ enum: SortDirection, default: SortDirection.Desc })
  @IsOptional()
  @IsEnum(SortDirection)
  sortOrder: SortDirection = SortDirection.Desc;

  @ApiPropertyOptional({
    enum: DeletedFilter,
    default: DeletedFilter.Exclude,
    description: 'Soft-deleted user visibility.',
  })
  @IsOptional()
  @IsEnum(DeletedFilter)
  deleted: DeletedFilter = DeletedFilter.Exclude;
}

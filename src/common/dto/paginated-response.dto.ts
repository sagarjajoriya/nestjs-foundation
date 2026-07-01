import { ApiProperty } from '@nestjs/swagger';

/** Pagination metadata accompanying a paginated payload. */
export class PaginationMetaDto {
  @ApiProperty({ example: 137 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 7 })
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;

  constructor(total: number, page: number, limit: number) {
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
    this.hasNext = page < this.totalPages;
    this.hasPrev = page > 1;
  }
}

/**
 * Generic paginated response envelope: `{ data, meta }`.
 *
 * The concrete `data` item schema is documented per-endpoint via the
 * `@ApiPaginatedResponse(Model)` decorator.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = new PaginationMetaDto(total, page, limit);
  }
}

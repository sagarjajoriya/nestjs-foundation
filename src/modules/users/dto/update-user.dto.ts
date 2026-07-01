import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload for administrative user updates (`PATCH /users/:id`).
 *
 * Intentionally excludes `password` (dedicated secure change flow) and only
 * exposes fields an administrator may safely mutate.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'user@example.com', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payload for a user updating their own profile (`PATCH /users/me`).
 *
 * Email changes (require re-verification) and password changes (require the
 * current password) are excluded here and handled by dedicated auth flows.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

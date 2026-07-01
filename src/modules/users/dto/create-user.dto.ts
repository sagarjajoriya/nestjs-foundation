import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsStrongPassword } from '@common/validators/is-strong-password.validator';

/**
 * Payload for administrative user creation (`POST /users`).
 *
 * Password changes and email verification are handled by dedicated auth flows;
 * this endpoint sets an initial password which is hashed before storage.
 */
export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'Str0ng!Passw0rd', minLength: 12 })
  @IsStrongPassword()
  password!: string;

  @ApiPropertyOptional({ example: 'Jane Doe', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

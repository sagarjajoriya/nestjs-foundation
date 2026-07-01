import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

import { IsStrongPassword } from '@common/validators/is-strong-password.validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the password-reset email.' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'New-S3cure-Passw0rd!' })
  @IsStrongPassword()
  newPassword!: string;
}

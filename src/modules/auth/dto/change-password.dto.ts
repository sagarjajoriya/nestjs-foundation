import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { IsStrongPassword } from '@common/validators/is-strong-password.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Old-Passw0rd!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({ example: 'New-S3cure-Passw0rd!' })
  @IsStrongPassword()
  newPassword!: string;
}

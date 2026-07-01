import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

import { IsStrongPassword } from '@common/validators/is-strong-password.validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    example: 'S3cure-Passw0rd!',
    description:
      'Min 12 chars with lowercase, uppercase, number and symbol characters.',
  })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ required: false, example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

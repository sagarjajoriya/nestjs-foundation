import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Deliberately NOT strong-password-validated: login must accept any existing
  // password, and revealing the policy here would leak nothing useful anyway.
  @ApiProperty({ example: 'S3cure-Passw0rd!' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;
}

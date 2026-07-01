import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * The refresh token may arrive in the body (API/mobile clients) or via the
 * HttpOnly cookie (web clients), so the body field is optional.
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token. Omit when it is sent via the HttpOnly cookie.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

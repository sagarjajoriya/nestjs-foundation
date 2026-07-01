import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AuthenticatedUser } from '@common/interfaces/authenticated-user.interface';

/** Compact principal returned alongside tokens. */
export class AuthUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ type: [String], example: ['USER'] })
  roles: string[];

  @ApiProperty()
  emailVerified: boolean;

  constructor(principal: AuthenticatedUser) {
    this.id = principal.id;
    this.email = principal.email;
    this.roles = principal.roles;
    this.emailVerified = principal.emailVerified;
  }
}

/** Access token envelope returned by login/register/refresh. */
export class AuthTokensDto {
  @ApiProperty({ description: 'RS256 JWT access token.' })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({
    example: 900,
    description: 'Access token lifetime (seconds).',
  })
  expiresIn!: number;

  @ApiPropertyOptional({
    description:
      'Refresh token. Present only when the refresh transport includes "body".',
  })
  refreshToken?: string;
}

/** Login/register response: tokens plus the authenticated user. */
export class AuthSessionDto extends AuthTokensDto {
  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;
}

/** Generic message envelope for flows that intentionally reveal nothing. */
export class MessageResponseDto {
  @ApiProperty({ example: 'If the account exists, an email has been sent.' })
  message!: string;
}

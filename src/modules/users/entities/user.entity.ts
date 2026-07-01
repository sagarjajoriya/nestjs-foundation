import { ApiProperty } from '@nestjs/swagger';
import type { User } from '@prisma/client';

/**
 * API representation of a user.
 *
 * Constructed by explicitly copying only safe fields from the Prisma record, so
 * `passwordHash` can never leak into a response — the class simply has no such
 * property. This is the single source of response-shape truth for users.
 */
export class UserEntity {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ nullable: true, type: String, example: 'Jane Doe' })
  name: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  emailVerifiedAt: Date | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt: Date | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  deletedAt: Date | null;

  constructor(user: User) {
    this.id = user.id;
    this.email = user.email;
    this.name = user.name;
    this.isActive = user.isActive;
    this.emailVerifiedAt = user.emailVerifiedAt;
    this.lastLoginAt = user.lastLoginAt;
    this.createdAt = user.createdAt;
    this.updatedAt = user.updatedAt;
    this.deletedAt = user.deletedAt;
  }
}

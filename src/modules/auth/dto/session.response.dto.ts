import { ApiProperty } from '@nestjs/swagger';
import type { Session } from '@prisma/client';

/** Public representation of a login session. */
export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true, type: String })
  userAgent: string | null;

  @ApiProperty({ nullable: true, type: String })
  ipAddress: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ format: 'date-time' })
  expiresAt: Date;

  @ApiProperty({
    description: 'True when this is the session making the request.',
  })
  current: boolean;

  constructor(session: Session, currentSessionId?: string) {
    this.id = session.id;
    this.userAgent = session.userAgent;
    this.ipAddress = session.ipAddress;
    this.createdAt = session.createdAt;
    this.expiresAt = session.expiresAt;
    this.current = session.id === currentSessionId;
  }
}

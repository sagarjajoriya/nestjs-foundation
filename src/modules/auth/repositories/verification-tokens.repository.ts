import { Injectable } from '@nestjs/common';
import { type VerificationToken, VerificationTokenType } from '@prisma/client';

import { PrismaService } from '@infra/prisma/prisma.service';

/** Data access for single-use email-verification / password-reset tokens. */
@Injectable()
export class VerificationTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    userId: string;
    type: VerificationTokenType;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<VerificationToken> {
    return this.prisma.verificationToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<VerificationToken | null> {
    return this.prisma.verificationToken.findUnique({ where: { tokenHash } });
  }

  /** Marks a token as consumed (single-use enforcement). */
  async consume(id: string): Promise<void> {
    await this.prisma.verificationToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  }

  /**
   * Consumes any outstanding tokens of a type for a user, so issuing a new one
   * invalidates prior links (only the latest email is ever valid).
   */
  async consumeOutstanding(
    userId: string,
    type: VerificationTokenType,
  ): Promise<void> {
    await this.prisma.verificationToken.updateMany({
      where: { userId, type, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

import { databaseConfig } from '@config/configuration';

/**
 * Application-wide Prisma client.
 *
 * Extends the generated `PrismaClient` and manages its lifecycle through Nest's
 * module hooks so connections are opened on startup and cleanly closed on
 * shutdown. Uses the Prisma 7 `@prisma/adapter-pg` driver adapter (there is no
 * Rust query-engine binary in Prisma 7 by default).
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    @Inject(databaseConfig.KEY)
    database: ConfigType<typeof databaseConfig>,
    private readonly logger: PinoLogger,
  ) {
    super({
      adapter: new PrismaPg({ connectionString: database.url }),
    });
    // `PinoLogger` is transient-scoped, so this context is instance-local and
    // does not bleed into other injectors.
    this.logger.setContext(PrismaService.name);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('Prisma connected to the database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.info('Prisma disconnected from the database');
  }
}

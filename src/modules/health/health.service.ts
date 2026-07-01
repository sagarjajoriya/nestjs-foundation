import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@infra/prisma/prisma.service';

import { HealthResponseDto } from './dto/health-response.dto';

/**
 * Encapsulates all health-check business logic.
 *
 * The controller stays thin; this service owns the actual probing (process
 * liveness and database readiness) so the logic is unit-testable in isolation.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(HealthService.name);
  }

  /**
   * Liveness: is the process up and able to respond? Deliberately does no I/O
   * so an orchestrator won't kill a pod merely because a dependency is slow.
   */
  checkLiveness(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness: can the app serve traffic (i.e. are its dependencies reachable)?
   * Verifies database connectivity with a trivial query. Throws 503 if not
   * ready so load balancers stop routing traffic here.
   */
  async checkReadiness(): Promise<HealthResponseDto> {
    const databaseUp = await this.isDatabaseReachable();

    if (!databaseUp) {
      throw new ServiceUnavailableException({
        message: 'Service not ready: database is unreachable.',
      });
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: { database: 'up' },
    };
  }

  private async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error: unknown) {
      this.logger.error({ err: error }, 'Database readiness check failed');
      return false;
    }
  }
}

import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';

import { PrismaService } from '@infra/prisma/prisma.service';

import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const loggerMock: Partial<PinoLogger> = {
      setContext: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(HealthService);
  });

  describe('checkLiveness', () => {
    it('reports ok without performing any I/O', () => {
      const result = service.checkLiveness();

      expect(result.status).toBe('ok');
      expect(typeof result.uptime).toBe('number');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('checkReadiness', () => {
    it('reports the database as up when reachable', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const result = await service.checkReadiness();

      expect(result.status).toBe('ok');
      expect(result.details).toEqual({ database: 'up' });
    });

    it('throws 503 when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));

      await expect(service.checkReadiness()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});

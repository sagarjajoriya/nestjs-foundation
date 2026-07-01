import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { PrismaService } from '@infra/prisma/prisma.service';

import { AppModule } from '../src/app.module';

// Environment is configured in `test/setup-e2e.ts` (Jest `setupFiles`), which
// runs before this module — and thus `AppModule` — is imported.
describe('Health (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror the production bootstrap so routes resolve under /v1.
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health returns liveness ok', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /v1/health/ready returns readiness ok when the DB is reachable', async () => {
    const response = await request(app.getHttpServer()).get('/v1/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.details).toEqual({ database: 'up' });
  });
});

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { appConfig, swaggerConfig } from '@config/configuration';

async function bootstrap(): Promise<void> {
  // `bufferLogs` holds startup logs until the Pino logger is wired in, so the
  // very first lines are also structured.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Route all framework logs through Pino (single, structured log stream).
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const swagger = app.get<ConfigType<typeof swaggerConfig>>(swaggerConfig.KEY);

  // --- Security headers ---
  app.use(helmet());

  // --- CORS (env-driven allowlist; never `*` when credentials are enabled) ---
  app.enableCors({
    origin: config.cors.origins.length > 0 ? config.cors.origins : false,
    credentials: config.cors.credentials,
  });

  // --- Optional global prefix (kept empty by default so routes are `/v1/...`) ---
  if (config.globalPrefix) {
    app.setGlobalPrefix(config.globalPrefix);
  }

  // --- URI API versioning; default `v1` ---
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // --- Global validation: strip unknown props, reject unexpected ones ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Implicit conversion is intentionally OFF to avoid silent coercion bugs;
      // DTOs declare explicit `@Type()` transforms where coercion is wanted.
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // --- Graceful shutdown (Prisma disconnect, etc.) ---
  app.enableShutdownHooks();

  // --- Swagger / OpenAPI (gated by env; typically disabled in production) ---
  if (swagger.enabled) {
    const documentConfig = new DocumentBuilder()
      .setTitle(swagger.title)
      .setDescription(swagger.description)
      .setVersion(swagger.version)
      // Bearer scheme declared now so Phase 2 auth endpoints slot in cleanly.
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup(swagger.path, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port);

  const logger = app.get(Logger);
  logger.log(
    `Application listening on port ${config.port} (${config.nodeEnv})`,
    'Bootstrap',
  );
  if (swagger.enabled) {
    logger.log(`Swagger UI available at /${swagger.path}`, 'Bootstrap');
  }
}

void bootstrap();

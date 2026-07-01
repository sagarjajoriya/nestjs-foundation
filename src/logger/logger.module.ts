import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

import { appConfig } from '@config/configuration';
import { NodeEnvironment } from '@config/env.validation';

/** Header used to carry a correlation id across service boundaries. */
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured logging via Pino (`nestjs-pino`).
 *
 * Responsibilities:
 *  - JSON logs in every non-local environment; pretty logs in development.
 *  - A correlation id per request (honoring an inbound `x-request-id`) so a
 *    single request can be traced across every log line and error response.
 *  - Redaction of sensitive fields so secrets never reach the log sink.
 *  - Automatic per-request access logs with tuned levels (5xx→error, 4xx→warn).
 */
@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (config: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level: config.logLevel,
          // Pretty output only in local development; JSON everywhere else.
          transport:
            config.nodeEnv === NodeEnvironment.Development
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
          // Reuse an inbound correlation id or generate a fresh one.
          genReqId: (req: IncomingMessage, res: ServerResponse): string => {
            const existing = req.headers[REQUEST_ID_HEADER];
            const id =
              (Array.isArray(existing) ? existing[0] : existing) ??
              randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          // Never log secrets. Redaction is applied at the logger level.
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.currentPassword',
              'req.body.newPassword',
              'req.body.token',
              'req.body.refreshToken',
              '*.password',
            ],
            censor: '[REDACTED]',
          },
          // Tune access-log verbosity by response class.
          customLogLevel: (
            _req: IncomingMessage,
            res: ServerResponse,
            err?: Error,
          ): 'error' | 'warn' | 'info' | 'silent' => {
            const status = res.statusCode;
            if (err || status >= 500) {
              return 'error';
            }
            if (status >= 400) {
              return 'warn';
            }
            // Keep health-check noise out of the logs.
            if (_req.url === '/v1/health' || _req.url === '/health') {
              return 'silent';
            }
            return 'info';
          },
          customProps: () => ({ context: 'HTTP' }),
        },
      }),
    }),
  ],
  // Re-export so `PinoLogger` / `@InjectPinoLogger()` resolve in every module
  // (combined with `@Global`, no feature module needs to import this).
  exports: [PinoLoggerModule],
})
export class LoggerModule {}

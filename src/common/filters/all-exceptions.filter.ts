import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { PinoLogger } from 'nestjs-pino';

import { ApiErrorResponse } from '@common/interfaces/api-error-response.interface';

/**
 * Catch-all exception filter producing a single, stable error envelope.
 *
 * Design:
 *  - Known `HttpException`s pass their status/message through.
 *  - Known Prisma errors are mapped to appropriate HTTP statuses (e.g. a unique
 *    constraint violation → 409) without leaking SQL/schema internals.
 *  - Anything else becomes a 500 whose *internal* detail is logged but never
 *    returned to the client, preventing information disclosure.
 *
 * The full error (including stack) is always logged server-side with the
 * request's correlation id so nothing is lost operationally.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(AllExceptionsFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error, message, logAsError } = this.resolve(exception);

    // `req.id` is attached at runtime by pino-http but not present on the
    // Express type, so we read it through a narrow structural cast.
    const requestId =
      (request as Request & { id?: string }).id ??
      (request.headers['x-request-id'] as string | undefined) ??
      'unknown';

    const body: ApiErrorResponse = {
      statusCode: status,
      error,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    // Log full detail server-side. 5xx are errors; 4xx are warnings.
    const logPayload = { err: exception, statusCode: status, path: body.path };
    if (logAsError) {
      this.logger.error(logPayload, 'Unhandled exception');
    } else {
      this.logger.warn(logPayload, 'Request failed');
    }

    response.status(status).json(body);
  }

  /**
   * Normalizes any thrown value into the pieces needed for the response body.
   */
  private resolve(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
    logAsError: boolean;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse();
      const message =
        typeof responseBody === 'string'
          ? responseBody
          : ((responseBody as { message?: string | string[] }).message ??
            exception.message);
      return {
        status,
        error: this.reasonPhrase(status),
        message,
        logAsError: status >= Number(HttpStatus.INTERNAL_SERVER_ERROR),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrisma(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        error: this.reasonPhrase(HttpStatus.BAD_REQUEST),
        message: 'Invalid database query.',
        logAsError: false,
      };
    }

    // Unknown/unexpected: never leak internals to the client.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: this.reasonPhrase(HttpStatus.INTERNAL_SERVER_ERROR),
      message: 'Internal server error',
      logAsError: true,
    };
  }

  /** Maps common Prisma error codes to HTTP semantics. */
  private resolvePrisma(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string | string[];
    logAsError: boolean;
  } {
    switch (exception.code) {
      case 'P2002': // Unique constraint failed
        return {
          status: HttpStatus.CONFLICT,
          error: this.reasonPhrase(HttpStatus.CONFLICT),
          message: 'A record with the provided value already exists.',
          logAsError: false,
        };
      case 'P2025': // Record not found
        return {
          status: HttpStatus.NOT_FOUND,
          error: this.reasonPhrase(HttpStatus.NOT_FOUND),
          message: 'The requested record was not found.',
          logAsError: false,
        };
      case 'P2003': // Foreign key constraint failed
        return {
          status: HttpStatus.BAD_REQUEST,
          error: this.reasonPhrase(HttpStatus.BAD_REQUEST),
          message: 'The operation violates a data relationship constraint.',
          logAsError: false,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: this.reasonPhrase(HttpStatus.INTERNAL_SERVER_ERROR),
          message: 'A database error occurred.',
          logAsError: true,
        };
    }
  }

  /**
   * Human-readable reason phrase for the status codes this filter emits.
   * An explicit map is clearer and safer than a reverse enum lookup (numeric
   * enums carry reverse mappings that make iteration error-prone).
   */
  private reasonPhrase(status: number): string {
    return AllExceptionsFilter.REASON_PHRASES[status] ?? 'Error';
  }

  private static readonly REASON_PHRASES: Readonly<Record<number, string>> = {
    [HttpStatus.BAD_REQUEST]: 'Bad Request',
    [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
    [HttpStatus.FORBIDDEN]: 'Forbidden',
    [HttpStatus.NOT_FOUND]: 'Not Found',
    [HttpStatus.CONFLICT]: 'Conflict',
    [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
    [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
    [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
    [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  };
}

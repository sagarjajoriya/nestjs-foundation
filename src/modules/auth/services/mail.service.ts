import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

/** Parameters for a transactional auth email. */
export interface AuthMailParams {
  email: string;
  name: string | null;
  /** Fully-qualified action link (verification or reset). */
  url: string;
}

/**
 * Transactional email port.
 *
 * An abstract class is used as the DI token so a production transport
 * (SES/SendGrid/SMTP) can be swapped in without touching callers — bind a new
 * implementation in `AuthModule`.
 */
export abstract class MailService {
  abstract sendEmailVerification(params: AuthMailParams): Promise<void>;
  abstract sendPasswordReset(params: AuthMailParams): Promise<void>;
}

/**
 * Development/test implementation: logs the action link instead of sending an
 * email. Fully functional for local flows; no external service required.
 */
@Injectable()
export class LoggerMailService extends MailService {
  constructor(private readonly logger: PinoLogger) {
    super();
    this.logger.setContext(LoggerMailService.name);
  }

  sendEmailVerification(params: AuthMailParams): Promise<void> {
    this.logger.info(
      { email: params.email, url: params.url },
      'Email verification link (dev mail transport)',
    );
    return Promise.resolve();
  }

  sendPasswordReset(params: AuthMailParams): Promise<void> {
    this.logger.info(
      { email: params.email, url: params.url },
      'Password reset link (dev mail transport)',
    );
    return Promise.resolve();
  }
}

import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { authConfig } from '@config/configuration';
import { UsersModule } from '@modules/users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { SessionsRepository } from './repositories/sessions.repository';
import { VerificationTokensRepository } from './repositories/verification-tokens.repository';
import { AuditService } from './services/audit.service';
import { LoggerMailService, MailService } from './services/mail.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

/**
 * Authentication module.
 *
 * Wires the RS256 JWT signer, Passport strategies, token/session/verification
 * repositories, and the auth orchestration service. Depends on `UsersModule`
 * for user reads/mutations; `HashingService` and `PrismaService` come from the
 * global security/database modules.
 */
@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (config: ConfigType<typeof authConfig>) => ({
        privateKey: config.jwt.privateKey,
        publicKey: config.jwt.publicKey,
        signOptions: {
          algorithm: config.jwt.algorithm,
          // Validated string (e.g. "15m"); cast to the ms StringValue type.
          expiresIn: config.jwt.accessTtl as JwtSignOptions['expiresIn'],
          issuer: config.jwt.issuer,
          audience: config.jwt.audience,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    AuditService,
    SessionsRepository,
    RefreshTokensRepository,
    VerificationTokensRepository,
    LocalStrategy,
    JwtStrategy,
    // Swap this binding for a real transport (SES/SendGrid/SMTP) in production.
    { provide: MailService, useClass: LoggerMailService },
  ],
})
export class AuthModule {}

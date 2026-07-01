import { UnauthorizedException } from '@nestjs/common';

import type { HashingService } from '@security/hashing.service';
import type { UsersService } from '@modules/users/users.service';
import type { UserWithRoles } from '@modules/users/users.repository';

import { AuthService } from './auth.service';
import type { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import type { SessionsRepository } from './repositories/sessions.repository';
import type { VerificationTokensRepository } from './repositories/verification-tokens.repository';
import type { AuditService } from './services/audit.service';
import type { MailService } from './services/mail.service';
import type { TokenService } from './services/token.service';

const config = {
  refresh: { ttl: '7d' },
  lockout: { maxFailedLogins: 5, lockoutMinutes: 15 },
  verification: { emailTtlMinutes: 1440, passwordResetTtlMinutes: 60 },
  publicUrl: 'http://localhost:3000',
} as unknown as ConstructorParameters<typeof AuthService>[8];

const buildUser = (overrides: Partial<UserWithRoles> = {}): UserWithRoles =>
  ({
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: 'argon2-hash',
    name: null,
    isActive: true,
    emailVerifiedAt: null,
    lockedUntil: null,
    failedLoginCount: 0,
    userRoles: [{ role: { name: 'USER' } }],
    ...overrides,
  }) as unknown as UserWithRoles;

describe('AuthService.validateCredentials', () => {
  let users: jest.Mocked<UsersService>;
  let hashing: jest.Mocked<HashingService>;
  let audit: jest.Mocked<AuditService>;
  let service: AuthService;

  beforeEach(async () => {
    users = {
      findAuthUserByEmail: jest.fn(),
      registerFailedLogin: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;
    hashing = {
      hash: jest.fn().mockResolvedValue('dummy-hash'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<HashingService>;
    audit = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;

    service = new AuthService(
      users,
      hashing,
      {} as unknown as TokenService,
      {} as unknown as SessionsRepository,
      {} as unknown as RefreshTokensRepository,
      {} as unknown as VerificationTokensRepository,
      {} as unknown as MailService,
      audit,
      config,
    );
    // Precompute the dummy hash used for timing equalization.
    await service.onModuleInit();
  });

  it('rejects an unknown user but still performs a verify (timing equalization)', async () => {
    users.findAuthUserByEmail.mockResolvedValue(null);

    await expect(
      service.validateCredentials('ghost@example.com', 'pw', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    // The dummy hash is verified so timing does not leak account existence.
    expect(hashing.verify).toHaveBeenCalledWith('dummy-hash', 'pw');
  });

  it('rejects a locked account without checking the password', async () => {
    users.findAuthUserByEmail.mockResolvedValue(
      buildUser({ lockedUntil: new Date(Date.now() + 60_000) }),
    );

    await expect(
      service.validateCredentials('jane@example.com', 'pw', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(hashing.verify).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalled();
  });

  it('records a failed login on wrong password', async () => {
    users.findAuthUserByEmail.mockResolvedValue(buildUser());
    hashing.verify.mockResolvedValue(false);

    await expect(
      service.validateCredentials('jane@example.com', 'wrong', {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.registerFailedLogin).toHaveBeenCalledWith('user-1', {
      maxFailedLogins: 5,
      lockoutMinutes: 15,
    });
  });

  it('returns the principal on valid credentials', async () => {
    users.findAuthUserByEmail.mockResolvedValue(buildUser());
    hashing.verify.mockResolvedValue(true);

    const principal = await service.validateCredentials(
      'jane@example.com',
      'correct',
      {},
    );

    expect(principal).toEqual({
      id: 'user-1',
      email: 'jane@example.com',
      roles: ['USER'],
      sessionId: undefined,
      emailVerified: false,
    });
  });
});

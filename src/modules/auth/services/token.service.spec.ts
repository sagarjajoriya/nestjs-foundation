import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { PinoLogger } from 'nestjs-pino';

import type { RefreshTokensRepository } from '../repositories/refresh-tokens.repository';
import type { SessionsRepository } from '../repositories/sessions.repository';
import { TokenService } from './token.service';

/** Minimal auth config used by the service constructor. */
const config = {
  refresh: { ttl: '7d' },
  jwt: { accessTtl: '15m' },
} as unknown as ConstructorParameters<typeof TokenService>[3];

const future = (): Date => new Date(Date.now() + 60_000);
const past = (): Date => new Date(Date.now() - 60_000);

describe('TokenService', () => {
  let refreshTokens: jest.Mocked<RefreshTokensRepository>;
  let sessions: jest.Mocked<SessionsRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let logger: jest.Mocked<PinoLogger>;
  let service: TokenService;

  beforeEach(() => {
    refreshTokens = {
      create: jest.fn(),
      findByHash: jest.fn(),
      markRotated: jest.fn(),
      revokeAllForSession: jest.fn(),
      revokeAllForUser: jest.fn(),
    } as unknown as jest.Mocked<RefreshTokensRepository>;
    sessions = {
      revoke: jest.fn(),
    } as unknown as jest.Mocked<SessionsRepository>;
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
    } as unknown as jest.Mocked<JwtService>;
    logger = {
      setContext: jest.fn(),
      warn: jest.fn(),
    } as unknown as jest.Mocked<PinoLogger>;

    service = new TokenService(
      jwtService,
      refreshTokens,
      sessions,
      config,
      logger,
    );
  });

  describe('rotateRefreshToken', () => {
    it('rotates a valid token and marks the old one replaced', async () => {
      refreshTokens.findByHash.mockResolvedValue({
        id: 'old-id',
        userId: 'user-1',
        sessionId: 'session-1',
        revokedAt: null,
        replacedById: null,
        expiresAt: future(),
      } as never);
      refreshTokens.create.mockResolvedValue({ id: 'new-id' } as never);

      const result = await service.rotateRefreshToken({
        presentedToken: 'opaque-token',
      });

      expect(result.userId).toBe('user-1');
      expect(result.sessionId).toBe('session-1');
      expect(result.refresh.token).toEqual(expect.any(String));
      expect(refreshTokens.markRotated).toHaveBeenCalledWith(
        'old-id',
        'new-id',
      );
    });

    it('detects reuse of a revoked token and revokes the session family', async () => {
      refreshTokens.findByHash.mockResolvedValue({
        id: 'old-id',
        userId: 'user-1',
        sessionId: 'session-1',
        revokedAt: new Date(),
        replacedById: 'successor',
        expiresAt: future(),
      } as never);

      await expect(
        service.rotateRefreshToken({ presentedToken: 'stolen' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(refreshTokens.revokeAllForSession).toHaveBeenCalledWith(
        'session-1',
      );
      expect(sessions.revoke).toHaveBeenCalledWith('session-1');
      expect(refreshTokens.markRotated).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
      refreshTokens.findByHash.mockResolvedValue(null);
      await expect(
        service.rotateRefreshToken({ presentedToken: 'nope' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      refreshTokens.findByHash.mockResolvedValue({
        id: 'old-id',
        userId: 'user-1',
        sessionId: 'session-1',
        revokedAt: null,
        replacedById: null,
        expiresAt: past(),
      } as never);

      await expect(
        service.rotateRefreshToken({ presentedToken: 'expired' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshTokens.create).not.toHaveBeenCalled();
    });
  });

  describe('hashToken', () => {
    it('is deterministic and does not return the plaintext', () => {
      const hash = service.hashToken('abc');
      expect(hash).toBe(service.hashToken('abc'));
      expect(hash).not.toBe('abc');
    });
  });
});

import { generateKeyPairSync } from 'node:crypto';

/** A resolved RS256 access-token keypair (PEM strings). */
export interface AccessKeyPair {
  privateKey: string;
  publicKey: string;
}

let cached: AccessKeyPair | null = null;

/**
 * Resolves the RS256 keypair used to sign/verify access tokens.
 *
 * Precedence:
 *  1. `JWT_ACCESS_PRIVATE_KEY` + `JWT_ACCESS_PUBLIC_KEY` (base64-encoded PEM) —
 *     the only supported source in production (enforced by env validation).
 *  2. Otherwise (dev/test): an ephemeral in-memory keypair is generated once.
 *     Tokens signed with it do not survive a process restart, which is fine
 *     locally. Run `pnpm auth:keygen` to mint persistent keys for shared envs.
 *
 * Memoized so the ephemeral keypair is stable for the life of the process.
 */
export function resolveAccessKeys(): AccessKeyPair {
  if (cached) {
    return cached;
  }

  const privateB64 = process.env.JWT_ACCESS_PRIVATE_KEY;
  const publicB64 = process.env.JWT_ACCESS_PUBLIC_KEY;

  if (privateB64 && publicB64) {
    cached = {
      privateKey: Buffer.from(privateB64, 'base64').toString('utf8'),
      publicKey: Buffer.from(publicB64, 'base64').toString('utf8'),
    };
    return cached;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  console.warn(
    '[auth] JWT_ACCESS_PRIVATE_KEY/JWT_ACCESS_PUBLIC_KEY are not set — ' +
      'generated an ephemeral RS256 keypair. Access tokens will be invalidated ' +
      'on restart. Run `pnpm auth:keygen` and set the keys for any shared env.',
  );

  cached = { privateKey, publicKey };
  return cached;
}

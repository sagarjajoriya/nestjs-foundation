import { generateKeyPairSync } from 'node:crypto';

/**
 * Generates an RS256 keypair for signing/verifying access tokens and prints the
 * base64-encoded PEM values ready to paste into `.env`.
 *
 * Usage: `pnpm auth:keygen`
 *
 * The private key must be kept secret (it signs tokens); the public key can be
 * distributed to any service that only needs to verify tokens.
 */
function main(): void {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const privateB64 = Buffer.from(privateKey, 'utf8').toString('base64');
  const publicB64 = Buffer.from(publicKey, 'utf8').toString('base64');

  console.log(
    [
      '# RS256 access-token keypair (base64-encoded PEM). Keep the private key secret.',
      `JWT_ACCESS_PRIVATE_KEY=${privateB64}`,
      `JWT_ACCESS_PUBLIC_KEY=${publicB64}`,
    ].join('\n'),
  );
}

main();

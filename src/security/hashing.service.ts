import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing via Argon2id.
 *
 * Centralized so the algorithm and parameters live in one place and are shared
 * across features (the users module now, the auth module later).
 */
@Injectable()
export class HashingService {
  /** Hashes a plaintext secret with Argon2id. */
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  /**
   * Verifies a plaintext secret against a stored hash. Returns `false` (never
   * throws) if the stored hash is malformed.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}

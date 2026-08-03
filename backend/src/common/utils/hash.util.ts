import { hash, verify, Algorithm } from '@node-rs/argon2';
import * as crypto from 'crypto';

/**
 * Argon2id parameters.
 *
 * Tuned to the OWASP Password Storage Cheat Sheet's second recommended
 * profile (19 MiB memory, 2 iterations, 1 degree of parallelism), which
 * targets roughly 50 ms per hash on server hardware. Raising `memoryCost`
 * is the cheapest way to harden this later; existing hashes keep verifying
 * because the parameters are encoded in the hash string itself.
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export class HashUtil {
  /**
   * Hashes a plaintext password with argon2id.
   *
   * The returned string embeds the algorithm, parameters and a per-hash
   * random salt, so no separate salt column is needed.
   */
  static async hashPassword(plaintext: string): Promise<string> {
    return hash(plaintext, ARGON2_OPTIONS);
  }

  /**
   * Verifies a plaintext password against a stored argon2 hash.
   *
   * Returns false rather than throwing when the stored value is malformed
   * or was produced by a different algorithm, so a corrupt row fails the
   * login instead of surfacing as a 500.
   */
  static async verifyPassword(storedHash: string, plaintext: string): Promise<boolean> {
    try {
      return await verify(storedHash, plaintext, ARGON2_OPTIONS);
    } catch {
      return false;
    }
  }

  /**
   * SHA-256, for non-secret digests only: refresh-token lookup keys,
   * idempotency keys, filter fingerprints used in cache keys.
   *
   * Never use this for passwords — it is unsalted and far too fast.
   */
  static sha256(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /** Cryptographically random hex token (refresh tokens, unsubscribe links). */
  static generateRandomToken(byteLength = 32): string {
    return crypto.randomBytes(byteLength).toString('hex');
  }

  /**
   * Constant-time comparison, for validating opaque tokens without leaking
   * their contents through response timing.
   */
  static safeEquals(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    if (bufferA.length !== bufferB.length) return false;
    return crypto.timingSafeEqual(bufferA, bufferB);
  }
}

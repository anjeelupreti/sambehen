import { HashUtil } from '../utils/hash.util';

describe('HashUtil', () => {
  describe('password hashing', () => {
    it('produces an argon2id hash that is not the plaintext', async () => {
      const hash = await HashUtil.hashPassword('correct horse battery staple');

      expect(hash).toMatch(/^\$argon2id\$/);
      expect(hash).not.toContain('correct horse battery staple');
    });

    it('salts each hash, so the same password hashes differently', async () => {
      const [a, b] = await Promise.all([
        HashUtil.hashPassword('same-password'),
        HashUtil.hashPassword('same-password'),
      ]);

      expect(a).not.toEqual(b);
      await expect(HashUtil.verifyPassword(a, 'same-password')).resolves.toBe(true);
      await expect(HashUtil.verifyPassword(b, 'same-password')).resolves.toBe(true);
    });

    it('verifies a correct password and rejects a wrong one', async () => {
      const hash = await HashUtil.hashPassword('s3cret-value');

      await expect(HashUtil.verifyPassword(hash, 's3cret-value')).resolves.toBe(true);
      await expect(HashUtil.verifyPassword(hash, 'S3cret-value')).resolves.toBe(false);
      await expect(HashUtil.verifyPassword(hash, '')).resolves.toBe(false);
    });

    it('returns false rather than throwing on a malformed stored hash', async () => {
      // A corrupt row must fail the login, not surface as a 500.
      await expect(HashUtil.verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
      await expect(HashUtil.verifyPassword('', 'anything')).resolves.toBe(false);
    });
  });

  describe('tokens', () => {
    it('generates a distinct hex token of the requested byte length', () => {
      const a = HashUtil.generateRandomToken(32);
      const b = HashUtil.generateRandomToken(32);

      expect(a).toHaveLength(64);
      expect(a).toMatch(/^[0-9a-f]+$/);
      expect(a).not.toEqual(b);
    });

    it('hashes deterministically with sha256 for lookup keys', () => {
      expect(HashUtil.sha256('abc')).toEqual(HashUtil.sha256('abc'));
      expect(HashUtil.sha256('abc')).not.toEqual(HashUtil.sha256('abd'));
    });
  });

  describe('safeEquals', () => {
    it('compares equal and unequal strings correctly', () => {
      expect(HashUtil.safeEquals('token-abc', 'token-abc')).toBe(true);
      expect(HashUtil.safeEquals('token-abc', 'token-abd')).toBe(false);
    });

    it('handles differing lengths without throwing', () => {
      expect(HashUtil.safeEquals('short', 'much-longer-value')).toBe(false);
    });
  });
});

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { generateChallenge, verifySignature, hashPublicKey, verifyPublicKeyHash } from '../lib/identityCrypto';

function generateTestKeyPair(): { publicKeyHex: string; privateKey: crypto.KeyObject } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  const raw = spki.subarray(spki.length - 32);
  return { publicKeyHex: raw.toString('hex'), privateKey };
}

function sign(challenge: string, privateKey: crypto.KeyObject): string {
  return crypto.sign(null, Buffer.from(challenge, 'utf8'), privateKey).toString('hex');
}

describe('identityCrypto', () => {
  describe('generateChallenge', () => {
    it('returns a 64-character hex string', () => {
      const c = generateChallenge();
      expect(c).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(c)).toBe(true);
    });

    it('produces unique challenges', () => {
      const a = generateChallenge();
      const b = generateChallenge();
      expect(a).not.toBe(b);
    });
  });

  describe('verifySignature', () => {
    it('verifies a valid ed25519 signature', () => {
      const { publicKeyHex, privateKey } = generateTestKeyPair();
      const challenge = 'test challenge';
      const signature = sign(challenge, privateKey);
      expect(verifySignature(publicKeyHex, challenge, signature)).toBe(true);
    });

    it('rejects a signature with wrong challenge', () => {
      const { publicKeyHex, privateKey } = generateTestKeyPair();
      const signature = sign('original challenge', privateKey);
      expect(verifySignature(publicKeyHex, 'wrong challenge', signature)).toBe(false);
    });

    it('rejects a signature with wrong public key', () => {
      const { privateKey } = generateTestKeyPair();
      const { publicKeyHex: otherKey } = generateTestKeyPair();
      const challenge = 'test challenge';
      const signature = sign(challenge, privateKey);
      expect(verifySignature(otherKey, challenge, signature)).toBe(false);
    });

    it('rejects invalid hex signature', () => {
      const { publicKeyHex } = generateTestKeyPair();
      expect(verifySignature(publicKeyHex, 'challenge', 'nothex')).toBe(false);
    });

    it('rejects empty signature', () => {
      const { publicKeyHex } = generateTestKeyPair();
      expect(verifySignature(publicKeyHex, 'challenge', '')).toBe(false);
    });

    it('rejects invalid public key hex', () => {
      expect(verifySignature('invalid', 'challenge', 'aa'.repeat(32))).toBe(false);
    });

    it('verifies 100 challenge-sign-verify rounds consistently', () => {
      const { publicKeyHex, privateKey } = generateTestKeyPair();
      for (let i = 0; i < 100; i++) {
        const challenge = generateChallenge();
        const signature = sign(challenge, privateKey);
        expect(verifySignature(publicKeyHex, challenge, signature)).toBe(true);
      }
    });
  });

  describe('hashPublicKey and verifyPublicKeyHash', () => {
    it('hashes and verifies a public key', async () => {
      const { publicKeyHex } = generateTestKeyPair();
      const hash = await hashPublicKey(publicKeyHex);
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(await verifyPublicKeyHash(publicKeyHex, hash)).toBe(true);
    }, 15000);

    it('rejects wrong public key against hash', async () => {
      const { publicKeyHex } = generateTestKeyPair();
      const { publicKeyHex: otherKey } = generateTestKeyPair();
      const hash = await hashPublicKey(publicKeyHex);
      expect(await verifyPublicKeyHash(otherKey, hash)).toBe(false);
    }, 15000);

    it('produces different hashes for different keys', async () => {
      const { publicKeyHex: a } = generateTestKeyPair();
      const { publicKeyHex: b } = generateTestKeyPair();
      const hashA = await hashPublicKey(a);
      const hashB = await hashPublicKey(b);
      expect(hashA).not.toBe(hashB);
    }, 15000);
  });
});

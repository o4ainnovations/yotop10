import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

function publicKeyHexToSPKI(publicKeyHex: string): Buffer {
  const raw = hexToBuffer(publicKeyHex);
  const prefix = Buffer.from('302a300506032b6570032100', 'hex');
  return Buffer.concat([prefix, raw]);
}

export function generateChallenge(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function verifySignature(publicKeyHex: string, challenge: string, signatureHex: string): boolean {
  try {
    const spki = publicKeyHexToSPKI(publicKeyHex);
    const publicKey = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(challenge, 'utf8'), publicKey, hexToBuffer(signatureHex));
  } catch {
    return false;
  }
}

export async function hashPublicKey(publicKeyHex: string): Promise<string> {
  return bcrypt.hash(publicKeyHex, BCRYPT_ROUNDS);
}

export async function verifyPublicKeyHash(publicKeyHex: string, hash: string): Promise<boolean> {
  return bcrypt.compare(publicKeyHex, hash);
}

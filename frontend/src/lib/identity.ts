'use client';

import { sha512 } from '@noble/hashes/sha2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import * as ed from '@noble/ed25519';
import { WORDLIST } from './bip39Wordlist';

ed.hashes.sha512 = sha512;

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return bytes.reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');
}

function bitsToWordIndices(bits: number[]): number[] {
  const indices: number[] = [];
  for (let i = 0; i < bits.length; i += 11) {
    const slice = bits.slice(i, i + 11);
    let index = 0;
    for (let j = 0; j < slice.length; j++) {
      index = (index << 1) | slice[j];
    }
    indices.push(index);
  }
  return indices;
}

function bytesToBits(bytes: Uint8Array): number[] {
  const bits: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    for (let j = 7; j >= 0; j--) {
      bits.push((bytes[i] >> j) & 1);
    }
  }
  return bits;
}

export async function generateMnemonic(): Promise<string> {
  const entropy = new Uint8Array(16);
  crypto.getRandomValues(entropy);

  const hash = sha256(entropy);
  const checksumBits = hash[0] >>> 4;

  const bits = bytesToBits(entropy);
  for (let i = 3; i >= 0; i--) {
    bits.push((checksumBits >> i) & 1);
  }

  const indices = bitsToWordIndices(bits);
  return indices.map((i) => WORDLIST[i]).join(' ');
}

export function validateMnemonic(mnemonic: string): boolean {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== 12) return false;

  for (const word of words) {
    if (!WORDLIST.includes(word)) return false;
  }

  const indices = words.map((w) => WORDLIST.indexOf(w));
  const bits: number[] = [];
  for (const idx of indices) {
    for (let j = 10; j >= 0; j--) {
      bits.push((idx >> j) & 1);
    }
  }

  const entropyBits = bits.slice(0, 128);
  const checksumBits = bits.slice(128, 132);

  const entropy = new Uint8Array(16);
  for (let i = 0; i < 128; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = 7 - (i % 8);
    if (entropyBits[i]) {
      entropy[byteIndex] |= (1 << bitIndex);
    }
  }

  const hash = sha256(entropy);
  const expectedChecksum = hash[0] >>> 4;

  let actualChecksum = 0;
  for (let i = 0; i < 4; i++) {
    if (checksumBits[i]) actualChecksum |= (1 << (3 - i));
  }

  return actualChecksum === expectedChecksum;
}

export async function mnemonicToKeyPair(mnemonic: string): Promise<{
  publicKeyHex: string;
  privateKeyBytes: Uint8Array;
}> {
  const normalized = mnemonic.trim().toLowerCase();

  const seed = pbkdf2(sha512, normalized, 'mnemonic', {
    c: 2048,
    dkLen: 64,
  });

  const privateKey = seed.slice(0, 32);
  const publicKey = await ed.getPublicKeyAsync(privateKey);

  return {
    publicKeyHex: bytesToHex(publicKey),
    privateKeyBytes: privateKey,
  };
}

export async function signChallenge(privateKeyBytes: Uint8Array, challenge: string): Promise<string> {
  const message = new TextEncoder().encode(challenge);
  const hash = sha256(message);
  const signature = await ed.signAsync(hash, privateKeyBytes);
  return bytesToHex(signature);
}

export { hexToBytes, bytesToHex };

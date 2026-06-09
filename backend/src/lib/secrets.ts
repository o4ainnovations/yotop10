import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const SECRETS_DIR = process.env.SECRETS_DIR || '/run/secrets';
const MIN_JWT_SECRET_LENGTH = 64;

const secretCache = new Map<string, string>();

function getSecretPath(name: string): string {
  return path.join(SECRETS_DIR, name.toLowerCase());
}

function getEnvVarName(name: string): string {
  return name.toUpperCase();
}

async function readFileSecret(filePath: string): Promise<string | null> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const trimmed = data.trim();
    if (!trimmed) {
      console.warn(`[SecretsManager] Secret file ${filePath} is empty`);
      return null;
    }
    return trimmed;
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.warn(`[SecretsManager] Error reading ${filePath}: ${(err as Error).message}`);
    return null;
  }
}

async function resolveSecret(name: string): Promise<string> {
  const filePath = getSecretPath(name);
  const fileSecret = await readFileSecret(filePath);
  if (fileSecret) return fileSecret;

  const envVarName = getEnvVarName(name);
  const envSecret = process.env[envVarName];
  if (envSecret) {
    console.warn(`[SecretsManager] Secret "${name}" loaded from env var ${envVarName}. Prefer Docker secrets for production.`);
    return envSecret;
  }

  throw new Error(
    `Secret "${name}" not found. Tried:\n` +
    `  1. Docker secret: ${filePath}\n` +
    `  2. Environment variable: ${envVarName}\n\n` +
    `Create a Docker secret or set the ${envVarName} environment variable.`
  );
}

function validateJwtSecret(secret: string): void {
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET length ${secret.length} is below minimum ${MIN_JWT_SECRET_LENGTH} characters. ` +
      `Generate a secure secret with: openssl rand -hex 32`
    );
  }
}

async function validateSecret(name: string, value: string): Promise<void> {
  if (name === 'JWT_SECRET') {
    validateJwtSecret(value);
  }
}

export const SecretsManager = {
  async getSecret(name: string): Promise<string> {
    const cached = secretCache.get(name);
    if (cached) return cached;

    const secret = await resolveSecret(name);
    await validateSecret(name, secret);
    secretCache.set(name, secret);
    return secret;
  },

  async getSecretWithFallback(name: string, fallback: string): Promise<string> {
    try {
      return await this.getSecret(name);
    } catch {
      console.warn(`[SecretsManager] Using fallback for "${name}"`);
      return fallback;
    }
  },

  async initialize(requiredSecrets: string[]): Promise<void> {
    const results = await Promise.allSettled(
      requiredSecrets.map((name) => this.getSecret(name))
    );

    const failures: string[] = [];
    for (let i = 0; i < requiredSecrets.length; i++) {
      if (results[i].status === 'rejected') {
        failures.push(requiredSecrets[i]);
      }
    }

    if (failures.length > 0) {
      console.error('[SecretsManager] FATAL: Required secrets could not be resolved:');
      for (const name of failures) {
        console.error(`  - ${name}`);
      }
      process.exit(1);
    }

    console.log(`[SecretsManager] Initialized: ${requiredSecrets.length} secrets resolved`);

    if (secretCache.has('JWT_SECRET')) {
      const jwts = secretCache.get('JWT_SECRET')!;
      console.log(`[SecretsManager] JWT_SECRET resolved (${jwts.length} chars)`);
    }
  },

  async rotateSecret(name: string): Promise<void> {
    secretCache.delete(name);
    await this.getSecret(name);
  },

  flushCache(): void {
    secretCache.clear();
  },

  generateSecureSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  },
};

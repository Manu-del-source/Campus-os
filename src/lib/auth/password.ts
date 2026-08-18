import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id password hashing following OWASP recommendations.
 *
 * - Algorithm: Argon2id (value 2)
 * - Memory cost: 19 MiB (19456 KiB)
 * - Iterations (time cost): 2
 * - Output length: 32 bytes
 * - Parallelism: 1 thread
 */
const ARGON2_OPTIONS = {
  algorithm: 2, // Algorithm.Argon2id
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

/**
 * Computes an Argon2id hash of the given plaintext password.
 * Never logs or retains the plaintext password.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * Returns false safely if the hash is invalid or verification fails.
 */
export async function verifyPassword(password: string, passwordHash: string | null | undefined): Promise<boolean> {
  if (!password || !passwordHash || typeof password !== 'string' || typeof passwordHash !== 'string') {
    return false;
  }
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

import argon2 from 'argon2';

/**
 * Hashes a plaintext password with argon2id using the library's default
 * cost parameters. Never hand-roll password hashing — argon2's own timing
 * characteristics are part of its security properties.
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Verifies a plaintext password against a stored argon2id hash.
 * Constant-time by construction — no hand-written comparison exists here.
 */
export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

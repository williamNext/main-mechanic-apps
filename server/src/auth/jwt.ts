import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { Role } from '../db/schema.js';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  jti: string;
  exp: number;
}

interface SignAccessTokenInput {
  userId: string;
  role: Role;
}

/**
 * Mints a signed access token. Every token carries a unique `jti` so it can
 * be individually identified (and, in a later plan, individually revoked).
 */
export function signAccessToken({ userId, role }: SignAccessTokenInput) {
  const jti = randomUUID();
  const token = jwt.sign({ sub: userId, role, jti }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRY_SECONDS,
  });
  const decoded = jwt.decode(token) as { exp: number };
  return { token, jti, exp: decoded.exp };
}

/**
 * Verifies a token's signature and expiry. The `algorithms` allowlist is
 * pinned to a single element deliberately — calling `verify()` without
 * pinning the expected algorithm is how servers end up accepting a token
 * whose header declares `alg: none` or a mismatched algorithm (T-01-01).
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload;
}

import { eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { isTokenRevoked } from './blocklist.js';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';
import type { Db } from '../db/client.js';
import { profiles, type Role } from '../db/schema.js';
import { HttpError } from '../errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * A single generic 401 for every rejection path in this middleware — a
 * missing header, a malformed header, a forged signature, or a revoked
 * token all look identical to the caller, so none of them discloses which
 * reason applied.
 */
const unauthorized = () => new HttpError(401, 'unauthorized', 'UNAUTHENTICATED');

/**
 * Builds the Fastify preHandler that authenticates a bearer token against
 * the given database handle. Verifies the signature through
 * `verifyAccessToken` — never by calling the JWT library directly, because
 * that wrapper is where the algorithm allowlist is pinned and bypassing it
 * is how a token declaring no algorithm gets accepted (T-03-01). Order
 * matters: the signature is verified FIRST, and only a signature-valid
 * token reaches the blocklist lookup — an unsigned or forged token never
 * causes a database read.
 *
 * This is the one shared hook every authenticated route in this project
 * uses; a route that forgets `requireAuth` is the only way to be
 * unauthenticated, and the revocation check living only here (rather than
 * duplicated per route) is what makes AUTH-03 apply uniformly.
 */
export function requireAuth(db: Db) {
  return async function authenticate(request: FastifyRequest): Promise<void> {
    const header = request.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      throw unauthorized();
    }

    const token = header.slice(BEARER_PREFIX.length);

    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw unauthorized();
    }

    if (isTokenRevoked(db, payload.jti)) {
      throw unauthorized();
    }

    request.user = payload;
  };
}

export function requireRole(db: Db, role: Role) {
  return async function authorize(request: FastifyRequest): Promise<void> {
    if (!request.user) {
      throw unauthorized();
    }

    const row = db
      .select({ role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, request.user.sub))
      .get();

    if (!row || row.role !== role) {
      throw new HttpError(403, 'forbidden', 'FORBIDDEN');
    }
  };
}

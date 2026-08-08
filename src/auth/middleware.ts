import type { FastifyReply, FastifyRequest } from 'fastify';
import { isTokenRevoked } from './blocklist.js';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';
import type { Db } from '../db/client.js';

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
const UNAUTHORIZED = { error: 'unauthorized' };

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
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    if (!header || !header.startsWith(BEARER_PREFIX)) {
      return reply.code(401).send(UNAUTHORIZED);
    }

    const token = header.slice(BEARER_PREFIX.length);

    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return reply.code(401).send(UNAUTHORIZED);
    }

    if (isTokenRevoked(db, payload.jti)) {
      return reply.code(401).send(UNAUTHORIZED);
    }

    request.user = payload;
  };
}

import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, type AccessTokenPayload } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

const BEARER_PREFIX = 'Bearer ';

/**
 * A single generic 401 for every rejection path in this middleware — a
 * missing header, a malformed header, a forged signature, or (from Task 2
 * onward) a revoked token all look identical to the caller, so none of them
 * discloses which reason applied.
 */
const UNAUTHORIZED = { error: 'unauthorized' };

/**
 * Fastify preHandler authenticating a bearer token. Verifies the signature
 * through `verifyAccessToken` — never by calling the JWT library directly,
 * because that wrapper is where the algorithm allowlist is pinned and
 * bypassing it is how a token declaring no algorithm gets accepted (T-03-01).
 *
 * Deliberately incomplete as of Task 1: it authenticates but does not yet
 * consult a revocation record, because `token_blocklist` does not exist
 * until Task 2. Task 2 completes it by adding the revocation check here,
 * after the signature verifies and before the request proceeds — this is
 * the one shared hook every authenticated route in this project uses, so a
 * route that forgets to use `requireAuth` is the only way to be
 * unauthenticated.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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

  request.user = payload;
}

import { eq, lt } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { tokenBlocklist } from '../db/schema.js';

export interface RevokeTokenInput {
  jti: string;
  exp: number;
}

/**
 * Records a jti as revoked. The expiry stored is ALWAYS the verified
 * token's own `exp` claim, taken from the caller — never recomputed from
 * the current time plus a configured duration, because a token minted
 * under a previous expiry setting would then be under-covered and become
 * usable again after pruning.
 *
 * Idempotent: logging out twice must not throw or create a second row.
 * The primary key on `jti` already gives this an index; `onConflictDoNothing`
 * makes a repeat revocation a silent no-op rather than a constraint error.
 */
export function revokeToken(db: Db, { jti, exp }: RevokeTokenInput): void {
  db.insert(tokenBlocklist)
    .values({ jti, expiresAt: exp, revokedAt: Math.floor(Date.now() / 1000) })
    .onConflictDoNothing()
    .run();
}

/**
 * A single indexed lookup by jti (the primary key).
 */
export function isTokenRevoked(db: Db, jti: string): boolean {
  const row = db.select().from(tokenBlocklist).where(eq(tokenBlocklist.jti, jti)).get();
  return row !== undefined;
}

/**
 * Deletes rows whose recorded expiry has already passed relative to
 * `nowSeconds` — and nothing else. A row may be removed only once the
 * token it revokes could no longer pass signature verification anyway.
 * Do NOT change this to an age-based, count-based, or fixed-retention-
 * window variant — any of those would silently un-revoke a token that is
 * still signature-valid, turning a housekeeping job into a mass
 * session-resurrection. This is a maintenance entry point; it is not
 * scheduled to run automatically in this phase, and AUTH-03's correctness
 * does not depend on it ever being called.
 */
export function pruneExpiredRevocations(db: Db, nowSeconds: number): void {
  db.delete(tokenBlocklist).where(lt(tokenBlocklist.expiresAt, nowSeconds)).run();
}

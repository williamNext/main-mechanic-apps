import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isTokenRevoked, pruneExpiredRevocations, revokeToken } from '../../src/auth/blocklist.js';
import { makeTestDb } from '../helpers/db.js';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe('token blocklist store', () => {
  let testDb: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    testDb = makeTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it('revoking a jti makes it report revoked and leaves an unrelated jti unrevoked', () => {
    revokeToken(testDb.db, { jti: 'jti-a', exp: nowSeconds() + 3600 });

    expect(isTokenRevoked(testDb.db, 'jti-a')).toBe(true);
    expect(isTokenRevoked(testDb.db, 'jti-b')).toBe(false);
  });

  it('revoking the same jti twice does not throw and does not create a second row', () => {
    const exp = nowSeconds() + 3600;

    expect(() => {
      revokeToken(testDb.db, { jti: 'jti-dup', exp });
      revokeToken(testDb.db, { jti: 'jti-dup', exp });
    }).not.toThrow();

    const count = testDb.connection
      .prepare('SELECT COUNT(*) as c FROM token_blocklist WHERE jti = ?')
      .get('jti-dup') as { c: number };
    expect(count.c).toBe(1);
  });

  it("persists the token's own exp claim as expires_at, not a value computed from the current time", () => {
    // Deliberately far from "now + any plausible default duration" so a
    // recompute-from-now implementation would produce a visibly different value.
    const exp = nowSeconds() + 999_999;
    revokeToken(testDb.db, { jti: 'jti-exp', exp });

    const row = testDb.connection
      .prepare('SELECT expires_at as expiresAt FROM token_blocklist WHERE jti = ?')
      .get('jti-exp') as { expiresAt: number };
    expect(row.expiresAt).toBe(exp);
  });

  it('pruning removes a row whose recorded expiry is in the past', () => {
    const past = nowSeconds() - 3600;
    revokeToken(testDb.db, { jti: 'jti-past', exp: past });

    pruneExpiredRevocations(testDb.db, nowSeconds());

    expect(isTokenRevoked(testDb.db, 'jti-past')).toBe(false);
  });

  it(
    'pruning does NOT remove a row whose recorded expiry is still in the future, ' +
      'even when that row was revoked long ago',
    () => {
      // Constructed directly (not through revokeToken) so revoked_at can be set
      // independently of expires_at — exactly the shape a naive age-based
      // cleanup would delete, and exactly what pruneExpiredRevocations must not.
      const longAgoRevokedAt = nowSeconds() - 999_999;
      const farFutureExpiry = nowSeconds() + 999_999;
      testDb.connection
        .prepare('INSERT INTO token_blocklist (jti, expires_at, revoked_at) VALUES (?, ?, ?)')
        .run('jti-old-but-valid', farFutureExpiry, longAgoRevokedAt);

      pruneExpiredRevocations(testDb.db, nowSeconds());

      expect(isTokenRevoked(testDb.db, 'jti-old-but-valid')).toBe(true);
    },
  );
});

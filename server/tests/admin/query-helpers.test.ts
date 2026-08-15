import { asc } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pagination, totalOrder } from '../../src/admin/query-helpers.js';
import { profiles } from '../../src/db/schema.js';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile } from '../helpers/profile.js';

describe('admin query helpers', () => {
  let testDb: ReturnType<typeof makeTestDb>;

  beforeEach(() => {
    testDb = makeTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it('appends ascending id as a tiebreak for rows sharing the primary sort value', () => {
    insertProfile(testDb, { id: 'mechanic-b', name: 'Ana', email: 'b@example.com' });
    insertProfile(testDb, { id: 'mechanic-z', name: 'Bruno', email: 'z@example.com' });
    insertProfile(testDb, { id: 'mechanic-a', name: 'Ana', email: 'a@example.com' });

    const rows = testDb.db
      .select({ id: profiles.id, name: profiles.name })
      .from(profiles)
      .orderBy(...totalOrder([asc(profiles.name)], profiles.id))
      .all();

    expect(rows).toEqual([
      { id: 'mechanic-a', name: 'Ana' },
      { id: 'mechanic-b', name: 'Ana' },
      { id: 'mechanic-z', name: 'Bruno' },
    ]);
  });

  it('converts one-based pages to SQL limit and offset', () => {
    expect(pagination(3, 20)).toEqual({ limit: 20, offset: 40 });
  });
});

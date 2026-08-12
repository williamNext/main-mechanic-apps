import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDb } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';

/**
 * Creates a throwaway SQLite file under the OS temp directory, applies
 * migrations to it, and returns the db handle plus a cleanup function.
 * Every test uses this helper so no test ever touches the developer's
 * real DB_PATH file.
 */
export function makeTestDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'workshop-server-test-'));
  const dbPath = path.join(dir, `${randomUUID()}.sqlite`);
  const { db, connection } = createDb(dbPath);
  runMigrations(db);

  function cleanup() {
    connection.close();
  }

  return { db, connection, cleanup };
}

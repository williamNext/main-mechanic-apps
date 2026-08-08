import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

/**
 * Opens a better-sqlite3 connection at `dbPath`, creating the parent
 * directory if it doesn't exist yet, and returns both the raw connection
 * and a Drizzle instance bound to it.
 *
 * Sets two pragmas on every connection this function opens:
 * - `journal_mode = WAL`: safe concurrent read/write on a single file.
 * - `foreign_keys = ON`: SQLite defaults foreign-key enforcement OFF, so
 *   every foreign key in this project is inert without this pragma.
 */
export function createDb(dbPath: string) {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    mkdirSync(dir, { recursive: true });
  }

  const connection = new Database(dbPath);
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');

  const db = drizzle(connection);

  return { db, connection };
}

export type Db = ReturnType<typeof createDb>['db'];
export type Connection = ReturnType<typeof createDb>['connection'];

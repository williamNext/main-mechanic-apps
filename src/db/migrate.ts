import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config/index.js';
import { createDb, type Db } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = path.join(__dirname, 'migrations');

/**
 * Applies every pending .sql migration in src/db/migrations against the
 * given Drizzle instance. Idempotent — Drizzle tracks applied migrations in
 * the `__drizzle_migrations` table, so re-running this is a no-op once
 * everything is already applied.
 */
export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

// Standalone entrypoint — makes `npm run db:migrate` (tsx src/db/migrate.ts) work.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const { db, connection } = createDb(config.DB_PATH);
  runMigrations(db);
  connection.close();
  console.log(`Migrations applied to ${config.DB_PATH}`);
}

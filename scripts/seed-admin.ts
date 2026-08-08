import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/auth/hash.js';
import { config } from '../src/config/index.js';
import { createDb, type Db } from '../src/db/client.js';
import { profiles } from '../src/db/schema.js';

/**
 * Matches signup's floor (`src/routes/auth.ts`'s SignupSchema) so the one
 * privileged account this project can ever mint isn't held to a weaker
 * standard than a public client signup.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * D-06 standalone admin bootstrap (`scripts/seed-admin.ts`). Run manually,
 * never mounted as a route and never triggered by an environment flag at
 * boot — this is a bootstrap, not an admin-creation API. Refuses to
 * proceed if any admin-role profile already exists so re-running it can
 * never quietly mint a second superuser.
 */
export class SeedAdminError extends Error {}

export interface SeedAdminInput {
  name: string;
  email: string;
  password: string;
}

export interface SeedAdminResult {
  id: string;
  email: string;
}

/**
 * Creates the sole admin profile. Importable directly by the test (and by
 * the CLI entrypoint below) so no test has to spawn a process. Prints the
 * created admin's id and email on success and NEVER the password — that
 * printing is part of this function's own contract, not the CLI wrapper's,
 * so it stays covered by the same test that exercises the creation logic.
 */
export async function seedAdmin(db: Db, input: SeedAdminInput): Promise<SeedAdminResult> {
  const { name, email, password } = input;

  if (!name || !email || !password) {
    throw new SeedAdminError('name, email, and password are all required');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new SeedAdminError(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const existingAdmin = db.select().from(profiles).where(eq(profiles.role, 'admin')).get();
  if (existingAdmin) {
    throw new SeedAdminError('an admin profile already exists; refusing to create a second one');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);
  const id = randomUUID();

  db.insert(profiles)
    .values({
      id,
      name,
      email: normalizedEmail,
      role: 'admin',
      passwordHash,
    })
    .run();

  console.log(`Admin created: ${id} (${normalizedEmail})`);

  return { id, email: normalizedEmail };
}

// CLI entrypoint — argument parsing only runs when this file is executed
// directly (`npm run seed:admin`), never when imported by the test. Takes
// the admin's credentials as command-line arguments rather than environment
// variables so an administrator password never lands in a `.env` file and
// the server's required configuration set stays exactly the four variables
// INFRA-01 documents.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password) {
    console.error('Usage: npm run seed:admin -- "<name>" "<email>" "<password>"');
    process.exit(1);
  }

  const { db, connection } = createDb(config.DB_PATH);
  seedAdmin(db, { name, email, password })
    .catch((err) => {
      console.error(err instanceof SeedAdminError ? err.message : 'Failed to create admin');
      process.exitCode = 1;
    })
    .finally(() => {
      connection.close();
    });
}

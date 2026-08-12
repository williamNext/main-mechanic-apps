import { randomUUID } from 'node:crypto';
import type { makeTestDb } from './db.js';

type TestDb = ReturnType<typeof makeTestDb>;

export function insertProfile(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string | null;
    avatarUrl: string | null;
    passwordHash: string;
  }> = {},
): string {
  const id = overrides.id ?? randomUUID();
  testDb.connection
    .prepare(
      `INSERT INTO profiles (id, name, email, role, phone, avatar_url, password_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      overrides.name ?? 'Test Person',
      overrides.email ?? `${id}@example.com`,
      overrides.role ?? 'client',
      overrides.phone ?? null,
      overrides.avatarUrl ?? null,
      overrides.passwordHash ?? 'hash',
    );
  return id;
}

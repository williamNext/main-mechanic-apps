import { randomUUID } from 'node:crypto';
import type { makeTestDb } from './db.js';
import { signAccessToken } from '../../src/auth/jwt.js';
import type { Role } from '../../src/db/schema.js';

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

export function makeMechanicToken(
  testDb: TestDb,
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    tokenRole: Role;
    specialty: string;
    credentials: string;
  }> = {},
) {
  const id = insertProfile(testDb, {
    id: overrides.id,
    name: overrides.name ?? 'Mechanic Person',
    email: overrides.email,
    role: 'mechanic',
  });
  testDb.connection
    .prepare('INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)')
    .run(id, overrides.specialty ?? 'Freios', overrides.credentials ?? 'ASE', 1);
  const { token } = signAccessToken({ userId: id, role: overrides.tokenRole ?? 'mechanic' });
  return { id, token };
}

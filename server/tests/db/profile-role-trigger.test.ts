import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile } from '../helpers/profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

const testDir = path.dirname(fileURLToPath(import.meta.url));

function insertMechanic(testDb: TestDb, id: string) {
  testDb.connection
    .prepare(`INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)`)
    .run(id, 'Motor', 'PENDENTE', 1);
}

function triggerCount(testDb: TestDb, where = ''): number {
  const row = testDb.connection
    .prepare(`SELECT count(*) as c FROM sqlite_master WHERE type = 'trigger' ${where}`)
    .get() as { c: number };
  return row.c;
}

function publicMechanicName(testDb: TestDb, id: string): string | undefined {
  const row = testDb.connection.prepare('SELECT name FROM public_mechanics WHERE id = ?').get(id) as
    | { name: string }
    | undefined;
  return row?.name;
}

describe('profiles.role database trigger enforcement', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = makeTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  it('accepts each allowed role on insert', () => {
    for (const role of ['admin', 'mechanic', 'client']) {
      const id = insertProfile(testDb, { role });
      const row = testDb.connection.prepare('SELECT role FROM profiles WHERE id = ?').get(id) as { role: string };
      expect(row.role).toBe(role);
    }
  });

  it('rejects superadmin on insert', () => {
    expect(() => insertProfile(testDb, { role: 'superadmin' })).toThrow(/invalid role/);
  });

  it('rejects empty string on insert', () => {
    expect(() => insertProfile(testDb, { role: '' })).toThrow(/invalid role/);
  });

  it('rejects invalid role updates', () => {
    const id = insertProfile(testDb, { role: 'client' });

    expect(() => {
      testDb.connection.prepare("UPDATE profiles SET role = 'superadmin' WHERE id = ?").run(id);
    }).toThrow(/invalid role/);

    const row = testDb.connection.prepare('SELECT role FROM profiles WHERE id = ?').get(id) as { role: string };
    expect(row.role).toBe('client');
  });

  it('allows name-only updates', () => {
    const id = insertProfile(testDb, { role: 'client', name: 'Ana Silva' });

    testDb.connection.prepare("UPDATE profiles SET name = 'Ana Santos' WHERE id = ?").run(id);

    const row = testDb.connection.prepare('SELECT name, role FROM profiles WHERE id = ?').get(id) as {
      name: string;
      role: string;
    };
    expect(row).toEqual({ name: 'Ana Santos', role: 'client' });
  });

  it('rejects INSERT OR REPLACE with an invalid role', () => {
    const id = insertProfile(testDb, { role: 'client' });

    expect(() => {
      testDb.connection
        .prepare(
          `INSERT OR REPLACE INTO profiles (id, name, email, role, password_hash)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(id, 'Ana Silva', 'replace@example.com', 'superadmin', 'hash');
    }).toThrow(/invalid role/);

    const row = testDb.connection.prepare('SELECT role FROM profiles WHERE id = ?').get(id) as { role: string };
    expect(row.role).toBe('client');
  });

  it('rejects ON CONFLICT DO UPDATE SET role with an invalid role', () => {
    const id = insertProfile(testDb, { role: 'client' });

    expect(() => {
      testDb.connection
        .prepare(
          `INSERT INTO profiles (id, name, email, role, password_hash)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET role = excluded.role`,
        )
        .run(id, 'Ana Silva', 'upsert@example.com', 'superadmin', 'hash');
    }).toThrow(/invalid role/);

    const row = testDb.connection.prepare('SELECT role FROM profiles WHERE id = ?').get(id) as { role: string };
    expect(row.role).toBe('client');
  });

  it('rejects role updates whose value comes from a subquery', () => {
    const id = insertProfile(testDb, { role: 'client' });

    expect(() => {
      testDb.connection.prepare("UPDATE profiles SET role = (SELECT 'superadmin') WHERE id = ?").run(id);
    }).toThrow(/invalid role/);

    const row = testDb.connection.prepare('SELECT role FROM profiles WHERE id = ?').get(id) as { role: string };
    expect(row.role).toBe('client');
  });

  it('keeps the six public_mechanics triggers and adds two role triggers', () => {
    expect(triggerCount(testDb)).toBe(8);
    expect(triggerCount(testDb, "AND name LIKE 'trg_public_mechanics_%'")).toBe(6);
    expect(triggerCount(testDb, "AND name LIKE 'trg_profiles_role_%'")).toBe(2);
  });

  it('still propagates mechanic profile name changes to public_mechanics', () => {
    const id = insertProfile(testDb, { role: 'mechanic', name: 'Nome Antigo' });
    insertMechanic(testDb, id);

    testDb.connection.prepare("UPDATE profiles SET name = 'Nome Novo' WHERE id = ?").run(id);

    expect(publicMechanicName(testDb, id)).toBe('Nome Novo');
  });

  it('keeps role enforcement in the handwritten migration and out of table rebuilds', () => {
    const migration = readFileSync(
      path.resolve(testDir, '../../src/db/migrations/0004_profiles_role_triggers.sql'),
      'utf8',
    );
    const schema = readFileSync(path.resolve(testDir, '../../src/db/schema.ts'), 'utf8');

    expect(migration).toContain('--> statement-breakpoint');
    expect(migration).toContain('RAISE(ABORT, \'invalid role\')');
    expect(migration).toContain('BEFORE INSERT ON profiles');
    expect(migration).toContain('BEFORE UPDATE OF role ON profiles');
    expect(migration).not.toMatch(/\bCHECK\b/i);
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(schema).toContain('Enforced by 0004_profiles_role_triggers.sql.');
  });
});

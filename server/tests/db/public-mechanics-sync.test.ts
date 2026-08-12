import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb } from '../helpers/db.js';
import { insertProfile } from '../helpers/profile.js';

type TestDb = ReturnType<typeof makeTestDb>;

function insertMechanic(
  testDb: TestDb,
  overrides: Partial<{ id: string; specialty: string; credentials: string; isActive: number }> = {},
): string {
  const id = overrides.id!;
  const hasIsActive = Object.prototype.hasOwnProperty.call(overrides, 'isActive');
  if (hasIsActive) {
    testDb.connection
      .prepare(`INSERT INTO mechanics (id, specialty, credentials, is_active) VALUES (?, ?, ?, ?)`)
      .run(id, overrides.specialty ?? 'Motor', overrides.credentials ?? 'PENDENTE', overrides.isActive);
  } else {
    testDb.connection
      .prepare(`INSERT INTO mechanics (id, specialty, credentials) VALUES (?, ?, ?)`)
      .run(id, overrides.specialty ?? 'Motor', overrides.credentials ?? 'PENDENTE');
  }
  return id;
}

function getPublicMechanic(testDb: TestDb, id: string) {
  return testDb.connection.prepare('SELECT * FROM public_mechanics WHERE id = ?').get(id) as
    | { id: string; name: string; specialty: string; avatar_url: string | null; updated_at: string }
    | undefined;
}

describe('DATA-03: public_mechanics self-maintaining projection', () => {
  let testDb: TestDb;

  beforeEach(() => {
    testDb = makeTestDb();
  });

  afterEach(() => {
    testDb.cleanup();
  });

  describe('installation', () => {
    it('installs the six public_mechanics projection triggers via the real migration path', () => {
      const row = testDb.connection
        .prepare("SELECT count(*) as c FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_public_mechanics_%'")
        .get() as { c: number };
      expect(row.c).toBe(6);
    });
  });

  describe('appearance', () => {
    it('produces no row from a mechanic-role profile alone, before a mechanics row exists', () => {
      const id = insertProfile(testDb, { role: 'mechanic', name: 'Ana Mechanic' });
      expect(getPublicMechanic(testDb, id)).toBeUndefined();
    });

    it('produces exactly one row once the matching active mechanics row is inserted', () => {
      const id = insertProfile(testDb, { role: 'mechanic', name: 'Ana Mechanic', avatarUrl: 'https://x/a.png' });
      insertMechanic(testDb, { id, specialty: 'Engine' });

      const row = getPublicMechanic(testDb, id);
      expect(row).toBeDefined();
      expect(row!.name).toBe('Ana Mechanic');
      expect(row!.specialty).toBe('Engine');
      expect(row!.avatar_url).toBe('https://x/a.png');

      const count = testDb.connection.prepare('SELECT count(*) as c FROM public_mechanics').get() as { c: number };
      expect(count.c).toBe(1);
    });

    it('produces no row when the inserted mechanics row is inactive', () => {
      const id = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id, isActive: 0 });
      expect(getPublicMechanic(testDb, id)).toBeUndefined();
    });
  });

  describe('propagation', () => {
    function makeActiveMechanic(testDb: TestDb, overrides: Parameters<typeof insertProfile>[1] = {}) {
      const id = insertProfile(testDb, { role: 'mechanic', ...overrides });
      insertMechanic(testDb, { id });
      return id;
    }

    it('propagates a profile name change', () => {
      const id = makeActiveMechanic(testDb, { name: 'Original Name' });
      testDb.connection.prepare('UPDATE profiles SET name = ? WHERE id = ?').run('New Name', id);
      expect(getPublicMechanic(testDb, id)!.name).toBe('New Name');
    });

    it('propagates a profile avatar_url change', () => {
      const id = makeActiveMechanic(testDb, { avatarUrl: 'https://x/old.png' });
      testDb.connection.prepare('UPDATE profiles SET avatar_url = ? WHERE id = ?').run('https://x/new.png', id);
      expect(getPublicMechanic(testDb, id)!.avatar_url).toBe('https://x/new.png');
    });

    it('propagates a mechanic specialty change', () => {
      const id = makeActiveMechanic(testDb);
      testDb.connection.prepare('UPDATE mechanics SET specialty = ? WHERE id = ?').run('Transmission', id);
      expect(getPublicMechanic(testDb, id)!.specialty).toBe('Transmission');
    });

    it('advances updated_at on each of the three propagating updates', () => {
      const idName = makeActiveMechanic(testDb);
      const before1 = getPublicMechanic(testDb, idName)!.updated_at;
      testDb.connection.prepare("UPDATE profiles SET name = 'Renamed' WHERE id = ?").run(idName);
      expect(getPublicMechanic(testDb, idName)!.updated_at >= before1).toBe(true);

      const idAvatar = makeActiveMechanic(testDb);
      const before2 = getPublicMechanic(testDb, idAvatar)!.updated_at;
      testDb.connection.prepare("UPDATE profiles SET avatar_url = 'https://x/z.png' WHERE id = ?").run(idAvatar);
      expect(getPublicMechanic(testDb, idAvatar)!.updated_at >= before2).toBe(true);

      const idSpecialty = makeActiveMechanic(testDb);
      const before3 = getPublicMechanic(testDb, idSpecialty)!.updated_at;
      testDb.connection.prepare("UPDATE mechanics SET specialty = 'Brakes' WHERE id = ?").run(idSpecialty);
      expect(getPublicMechanic(testDb, idSpecialty)!.updated_at >= before3).toBe(true);
    });

    it('leaves the row present and unchanged when a non-projected column (phone) is updated', () => {
      const id = makeActiveMechanic(testDb);
      const before = getPublicMechanic(testDb, id)!;
      testDb.connection.prepare('UPDATE profiles SET phone = ? WHERE id = ?').run('+5511999999999', id);
      const after = getPublicMechanic(testDb, id)!;
      expect(after).toEqual(before);
    });
  });

  describe('withdrawal', () => {
    it('removes the row when is_active is set to 0, and restores it when set back to 1', () => {
      const id = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id });
      expect(getPublicMechanic(testDb, id)).toBeDefined();

      testDb.connection.prepare('UPDATE mechanics SET is_active = 0 WHERE id = ?').run(id);
      expect(getPublicMechanic(testDb, id)).toBeUndefined();

      testDb.connection.prepare('UPDATE mechanics SET is_active = 1 WHERE id = ?').run(id);
      expect(getPublicMechanic(testDb, id)).toBeDefined();
    });

    it('removes the row when the profile role changes from mechanic to client', () => {
      const id = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id });
      expect(getPublicMechanic(testDb, id)).toBeDefined();

      testDb.connection.prepare("UPDATE profiles SET role = 'client' WHERE id = ?").run(id);
      expect(getPublicMechanic(testDb, id)).toBeUndefined();
    });

    it('removes the row when the mechanics row is deleted', () => {
      const id = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id });
      expect(getPublicMechanic(testDb, id)).toBeDefined();

      testDb.connection.prepare('DELETE FROM mechanics WHERE id = ?').run(id);
      expect(getPublicMechanic(testDb, id)).toBeUndefined();
    });

    it('removes the row when the profiles row is deleted', () => {
      const id = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id });
      expect(getPublicMechanic(testDb, id)).toBeDefined();

      testDb.connection.prepare('DELETE FROM profiles WHERE id = ?').run(id);
      expect(getPublicMechanic(testDb, id)).toBeUndefined();
    });
  });

  describe('exclusion', () => {
    it('never lists a client-role or admin-role profile, even sharing a name with a listed mechanic', () => {
      const sharedName = 'Alex Silva';
      const clientId = insertProfile(testDb, { role: 'client', name: sharedName });
      const adminId = insertProfile(testDb, { role: 'admin', name: sharedName });
      const mechanicId = insertProfile(testDb, { role: 'mechanic', name: sharedName });
      insertMechanic(testDb, { id: mechanicId });

      expect(getPublicMechanic(testDb, clientId)).toBeUndefined();
      expect(getPublicMechanic(testDb, adminId)).toBeUndefined();
      expect(getPublicMechanic(testDb, mechanicId)).toBeDefined();
    });

    it('keeps public_mechanics count equal to the count of currently-active mechanic profiles', () => {
      const activeId = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id: activeId });

      const inactiveId = insertProfile(testDb, { role: 'mechanic' });
      insertMechanic(testDb, { id: inactiveId, isActive: 0 });

      insertProfile(testDb, { role: 'client' });
      insertProfile(testDb, { role: 'admin' });

      const left = testDb.connection.prepare('SELECT count(*) as c FROM public_mechanics').get() as { c: number };
      const right = testDb.connection
        .prepare(
          `SELECT count(*) as c FROM profiles p
           JOIN mechanics m ON m.id = p.id
           WHERE p.role = 'mechanic' AND m.is_active = 1`,
        )
        .get() as { c: number };
      expect(left.c).toBe(right.c);
    });
  });
});

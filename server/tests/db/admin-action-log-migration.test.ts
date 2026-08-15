import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/client.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(testDir, '../../src/db/migrations');
const projectRoot = path.resolve(testDir, '../../..');

describe('0006 admin_action_log action migration', () => {
  let database: ReturnType<typeof createDb>;

  beforeEach(() => {
    const directory = mkdtempSync(path.join(tmpdir(), 'admin-action-log-migration-'));
    database = createDb(path.join(directory, `${randomUUID()}.sqlite`));
    for (const migration of [
      '0000_tranquil_kinsey_walden.sql',
      '0001_many_senator_kelly.sql',
      '0002_public_mechanics_triggers.sql',
      '0003_thick_sleepwalker.sql',
      '0004_profiles_role_triggers.sql',
      '0005_massive_demogoblin.sql',
    ]) {
      database.connection.exec(readFileSync(path.join(migrationsDir, migration), 'utf8'));
    }
  });

  afterEach(() => {
    database.connection.close();
  });

  it('preserves audit state, recreates both indexes, accepts new actions, and rejects unknown actions', () => {
    database.connection
      .prepare(
        `INSERT INTO profiles (id, name, email, role, password_hash)
         VALUES ('migration-admin', 'Admin', 'migration-admin@example.com', 'admin', 'hash'),
                ('migration-mechanic', 'Mechanic', 'migration-mechanic@example.com', 'mechanic', 'hash')`,
      )
      .run();
    database.connection
      .prepare("INSERT INTO mechanics (id, specialty, credentials) VALUES ('migration-mechanic', 'Freios', 'CRT')")
      .run();
    const beforeState = '{"nested":{"before":"intact"}}';
    const afterState = '{"nested":{"after":"intact"}}';
    database.connection
      .prepare(
        `INSERT INTO admin_action_log
         (id, actor_id, target_mechanic_id, action, before_state, after_state)
         VALUES ('existing-audit', 'migration-admin', 'migration-mechanic', 'create_mechanic', ?, ?)`,
      )
      .run(beforeState, afterState);

    database.connection.exec(readFileSync(path.join(migrationsDir, '0006_yummy_vanisher.sql'), 'utf8'));

    expect(
      database.connection
        .prepare('SELECT before_state AS beforeState, after_state AS afterState FROM admin_action_log WHERE id = ?')
        .get('existing-audit'),
    ).toEqual({ beforeState, afterState });
    expect(
      database.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'admin_action_log' ORDER BY name")
        .all(),
    ).toEqual([
      { name: 'admin_action_log_actor_created_idx' },
      { name: 'admin_action_log_target_created_idx' },
      { name: 'sqlite_autoindex_admin_action_log_1' },
    ]);
    expect(() =>
      database.connection
        .prepare("INSERT INTO admin_action_log (id, action) VALUES ('deactivate-row', 'deactivate_mechanic')")
        .run(),
    ).not.toThrow();
    expect(() =>
      database.connection
        .prepare("INSERT INTO admin_action_log (id, action) VALUES ('reactivate-row', 'reactivate_mechanic')")
        .run(),
    ).not.toThrow();
    expect(() =>
      database.connection
        .prepare("INSERT INTO admin_action_log (id, action) VALUES ('unknown-row', 'unknown_action')")
        .run(),
    ).toThrow();
  });
});

describe('admin deactivation documentation', () => {
  it('records the ADR, normative cancellation branch, schema note, glossary, use case, decision, and requirement', () => {
    const adr = readFileSync(
      path.join(projectRoot, 'docs/adr/0001-deactivate-instead-of-delete-mechanics.md'),
      'utf8',
    );
    const context = readFileSync(path.join(projectRoot, 'PROJECT_CONTEXT.md'), 'utf8');
    const requirements = readFileSync(path.join(projectRoot, 'REQUIREMENTS.md'), 'utf8');

    expect(adr).toContain('This phase ships no true-delete path for mechanics.');
    expect(adr).toContain("Every client's service history and every finished job's revenue remain intact.");
    expect(context).toContain('**UC-AD9 · Deactivate and reactivate mechanics**');
    expect(context).toContain('| | Client cancel | Mechanic cancel | Admin deactivate-cancel |');
    expect(context).toContain('Migration `0006` rebuilt this table to widen its `action` CHECK.');
    expect(context).toContain('| **D-V** | Mechanic removal semantics |');
    expect(context).toContain("Extends D-I's admin-only write surface");
    expect(context).toContain(
      '| Deactivated | a mechanic an admin has removed from service; not bookable, not in `public_mechanics`, all history retained, reversible |',
    );
    expect(requirements).toContain('| **ADMIN-02** | Admin can deactivate and reactivate a mechanic account');
  });
});

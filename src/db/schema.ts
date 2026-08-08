import { sql } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Single source of truth for the `profiles.role` value set. Both the SQLite
 * CHECK constraint and the exported `Role` type derive from this array so
 * there is exactly one place the value list is edited (Pitfall 3,
 * 01-RESEARCH.md).
 */
export const ROLES = ['admin', 'mechanic', 'client'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Ported from the canonical Postgres schema
 * (mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql),
 * with two deliberate divergences:
 *
 * - `email` is NOT NULL + UNIQUE here even though the Postgres source later
 *   relaxed it to nullable for phone-only auth (Pitfall 1) — this project
 *   drops phone/SMS auth entirely, so the original NOT NULL intent is the
 *   correct one to port.
 * - `password_hash` has no counterpart in the Postgres source at all — there,
 *   Supabase Auth owned credentials out-of-band; this server owns them
 *   directly, so the column is new.
 */
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role', { enum: ROLES }).notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

import { desc, sql } from 'drizzle-orm';
import { check, index, sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Renders a static, code-controlled string literal set (never user input) as a SQL `IN (...)`
 * value list for use inside a CHECK constraint. Bound parameters (`?`) are not usable inside a
 * CHECK constraint's stored DDL text — SQLite rejects them at CREATE TABLE time with "parameters
 * prohibited in CHECK constraints" — so the literal values must be inlined directly. Safe here
 * because every caller passes one of this file's own `as const` arrays (ROLES-style literal
 * sets), never a runtime/user-supplied value.
 */
function sqlLiteralInList(values: readonly string[]) {
  return sql.raw(values.map((v) => `'${v.replaceAll("'", "''")}'`).join(', '));
}

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
  role: text('role', { enum: ROLES }).notNull(), // Enforced by 0004_profiles_role_triggers.sql.
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

/**
 * Appointment status literal set (01-02-PLAN.md Task 1). Takes the FOUR-value
 * set from the finance migration
 * (mechanic/scripts/sql/2026-05-24_appointment_closure_finance.sql:26-28),
 * not the three-value set in the original rebuild file — the finance
 * migration dropped and replaced the original constraint, and only the later
 * state is correct to port.
 */
export const APPOINTMENT_STATUSES = ['confirmado', 'nao_finalizado', 'cancelado', 'acabado'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/**
 * Admin action log literal set. Deliberately diverges from the source
 * system's final constraint
 * (admin/scripts/sql/2026-05-24_admin_bulk_delete_mechanics.sql:6-8), which
 * still lists 'approve_mechanic' and 'reject_mechanic' — both dead once the
 * mechanic-approval flow was removed
 * (admin/scripts/sql/2026-05-25_remove_mechanic_approval_flow.sql) — and
 * lacks any value for mechanic creation entirely. This project carries over
 * no historical rows and supports create, future true deletion, deactivation,
 * and reactivation actions for Phase 3's ADMIN-01/ADMIN-02 surface.
 */
export const ADMIN_ACTIONS = [
  'create_mechanic',
  'delete_mechanic',
  'deactivate_mechanic',
  'reactivate_mechanic',
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

/**
 * Ported from
 * mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:37-42,
 * with one deliberate divergence: `isActive` defaults to true here, matching
 * the state AFTER
 * admin/scripts/sql/2026-05-25_remove_mechanic_approval_flow.sql removed the
 * approval-guard flow (Pitfall 2, 01-RESEARCH.md) — this project builds no
 * approval-guard equivalent for the removed flow.
 */
export const mechanics = sqliteTable(
  'mechanics',
  {
    id: text('id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    specialty: text('specialty').notNull(),
    credentials: text('credentials').notNull().default('PENDENTE'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('mechanics_active_credentials_idx').on(t.isActive, t.credentials)],
);

/**
 * Ported from
 * mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:44-53,83-84,90-91.
 */
export const timeslots = sqliteTable(
  'timeslots',
  {
    id: text('id').primaryKey(),
    mechanicId: text('mechanic_id')
      .notNull()
      .references(() => mechanics.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    isAvailable: integer('is_available', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    check('timeslots_time_order_check', sql`${t.endTime} > ${t.startTime}`),
    uniqueIndex('timeslots_mechanic_date_time_unique_idx').on(t.mechanicId, t.date, t.startTime, t.endTime),
    index('timeslots_mechanic_date_available_start_idx').on(t.mechanicId, t.date, t.isAvailable, t.startTime),
  ],
);

/**
 * Ported from
 * mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:55-68,79-81,93-97,
 * and mechanic/scripts/sql/2026-05-24_appointment_closure_finance.sql:23-33,67-68 (four-value
 * status set, the "one active appointment per timeslot" partial unique index, and the
 * date/status/mechanic lookup index).
 *
 * The partial unique index over `timeslot_id` is this project's entire database-level defence
 * against double-booking (Phase 2, BOOK-01) — restricted to rows whose status is one of the two
 * active values, so a cancelled booking frees the slot for rebooking.
 */
export const appointments = sqliteTable(
  'appointments',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    mechanicId: text('mechanic_id')
      .notNull()
      .references(() => mechanics.id, { onDelete: 'cascade' }),
    timeSlotId: text('timeslot_id').references(() => timeslots.id, { onDelete: 'set null' }),
    date: text('date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    status: text('status', { enum: APPOINTMENT_STATUSES }).notNull().default('confirmado'),
    vehicleInfo: text('vehicle_info'),
    notes: text('notes'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    // Drizzle's `{ enum: [...] }` column option is TypeScript-only type narrowing — it does NOT
    // emit a SQL CHECK constraint (confirmed by inspecting drizzle-kit's generated DDL), so the
    // value set must be enforced explicitly here to actually reject an out-of-set status at the
    // database level.
    check('appointments_status_check', sql`${t.status} IN (${sqlLiteralInList(APPOINTMENT_STATUSES)})`),
    check('appointments_time_order_check', sql`${t.endTime} > ${t.startTime}`),
    check('appointments_vehicle_info_length_check', sql`length(coalesce(${t.vehicleInfo}, '')) <= 120`),
    check('appointments_notes_length_check', sql`length(coalesce(${t.notes}, '')) <= 1000`),
    index('appointments_client_date_desc_idx').on(t.clientId, desc(t.date)),
    index('appointments_mechanic_date_desc_idx').on(t.mechanicId, desc(t.date)),
    index('appointments_date_status_mechanic_idx').on(desc(t.date), t.status, t.mechanicId),
    uniqueIndex('appointments_one_active_per_timeslot')
      .on(t.timeSlotId)
      .where(sql`${t.status} IN ('confirmado', 'nao_finalizado') AND ${t.timeSlotId} IS NOT NULL`),
  ],
);

/**
 * Denormalized read-only projection of `profiles`/`mechanics`, ported from
 * mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:70-76. Exactly
 * these five columns and no others — this is the one table readable by unauthenticated callers
 * in the source system (DATA-03 privacy prohibition). Task 2's six triggers are its only writer;
 * nothing in application code inserts, updates, or deletes here directly.
 */
export const publicMechanics = sqliteTable('public_mechanics', {
  id: text('id')
    .primaryKey()
    .references(() => mechanics.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  specialty: text('specialty').notNull(),
  avatarUrl: text('avatar_url'),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

/**
 * Ported from
 * mechanic/scripts/sql/2026-05-24_appointment_closure_finance.sql:35-47,61-62.
 */
export const appointmentServiceReports = sqliteTable(
  'appointment_service_reports',
  {
    appointmentId: text('appointment_id')
      .primaryKey()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    mechanicId: text('mechanic_id')
      .notNull()
      .references(() => mechanics.id, { onDelete: 'cascade' }),
    summary: text('summary').notNull(),
    diagnosis: text('diagnosis'),
    workPerformed: text('work_performed').notNull(),
    partsUsed: text('parts_used'),
    recommendations: text('recommendations'),
    totalAmountCents: integer('total_amount_cents').notNull(),
    closedAt: text('closed_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    check('appointment_service_reports_summary_length_check', sql`length(trim(${t.summary})) BETWEEN 3 AND 240`),
    check('appointment_service_reports_diagnosis_length_check', sql`length(coalesce(${t.diagnosis}, '')) <= 1000`),
    check(
      'appointment_service_reports_work_performed_length_check',
      sql`length(trim(${t.workPerformed})) BETWEEN 3 AND 2000`,
    ),
    check('appointment_service_reports_parts_used_length_check', sql`length(coalesce(${t.partsUsed}, '')) <= 1000`),
    check(
      'appointment_service_reports_recommendations_length_check',
      sql`length(coalesce(${t.recommendations}, '')) <= 1000`,
    ),
    check('appointment_service_reports_total_amount_cents_check', sql`${t.totalAmountCents} >= 0`),
    index('appointment_service_reports_mechanic_closed_idx').on(t.mechanicId, desc(t.closedAt)),
  ],
);

/**
 * Ported from
 * mechanic/scripts/sql/2026-05-24_appointment_closure_finance.sql:49-56,64-65.
 */
export const appointmentServiceItems = sqliteTable(
  'appointment_service_items',
  {
    id: text('id').primaryKey(),
    appointmentId: text('appointment_id')
      .notNull()
      .references(() => appointmentServiceReports.appointmentId, { onDelete: 'cascade' }),
    description: text('description').notNull(),
    amountCents: integer('amount_cents').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    check('appointment_service_items_description_length_check', sql`length(trim(${t.description})) BETWEEN 2 AND 160`),
    check('appointment_service_items_amount_cents_check', sql`${t.amountCents} >= 0`),
    check('appointment_service_items_sort_order_check', sql`${t.sortOrder} >= 0`),
    index('appointment_service_items_appointment_order_idx').on(t.appointmentId, t.sortOrder),
  ],
);

/**
 * Ported from admin/scripts/sql/2026-05-22_admin_operations.sql:23-40, with the `action` CHECK
 * constraint replaced by `ADMIN_ACTIONS` above (see that constant's comment for why) and the
 * mechanics `(is_active, credentials)` index carried over onto the `mechanics` table definition
 * above rather than duplicated here.
 */
export const adminActionLog = sqliteTable(
  'admin_action_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
    targetMechanicId: text('target_mechanic_id').references(() => mechanics.id, { onDelete: 'set null' }),
    action: text('action', { enum: ADMIN_ACTIONS }).notNull(),
    note: text('note'),
    beforeState: text('before_state').notNull().default('{}'),
    afterState: text('after_state').notNull().default('{}'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    // Same reasoning as appointments_status_check above: `{ enum: [...] }` is TS-only, so the
    // allowed action set needs an explicit CHECK to be enforced at the database level.
    check('admin_action_log_action_check', sql`${t.action} IN (${sqlLiteralInList(ADMIN_ACTIONS)})`),
    check('admin_action_log_note_length_check', sql`length(coalesce(${t.note}, '')) <= 500`),
    index('admin_action_log_target_created_idx').on(t.targetMechanicId, desc(t.createdAt)),
    index('admin_action_log_actor_created_idx').on(t.actorId, desc(t.createdAt)),
  ],
);

/** Eight-column notification read model consumed by authenticated notification endpoints. */
export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    appointmentId: text('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    readAt: text('read_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (t) => [
    index('notifications_recipient_created_idx').on(t.recipientId, desc(t.createdAt)),
    index('notifications_recipient_unread_idx').on(t.recipientId, t.readAt),
  ],
);

/**
 * Session revocation store (D-04/D-05, AUTH-03, 01-03-PLAN.md Task 2). A single
 * long-lived token (D-03) cannot be ended by expiry alone, so logout writes an
 * explicit revocation record here — an in-memory store was rejected because a
 * server restart would silently un-revoke every token. `requireAuth` consults
 * this table on every authenticated request, after the signature verifies.
 *
 * Deliberate divergence from this schema's ISO-8601 TEXT timestamp convention:
 * `expires_at` and `revoked_at` are INTEGER unix seconds, not TEXT. The only
 * purpose of `expires_at` is to be compared against the JWT's own numeric
 * `exp` claim, and a text/number mismatch there is exactly how a pruning job
 * could silently un-revoke a token that is still signature-valid. `revoked_at`
 * follows the same integer form for consistency within this one table.
 *
 * The primary key on `jti` gives the revocation lookup an index for free and
 * makes double revocation a no-op (idempotent insert) rather than a duplicate
 * row.
 */
export const tokenBlocklist = sqliteTable('token_blocklist', {
  jti: text('jti').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at').notNull(),
});

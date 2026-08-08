# Requirements: Workshop Backend Server (Supabase Replacement)

**Defined:** 2026-08-07
**Core Value:** Clients can book a mechanic timeslot and mechanics/admins can manage it without double-booking or losing cross-app visibility — matching current Supabase+Postgres guarantees, self-hosted on SQLite.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: Client can sign up with email and password
- [ ] **AUTH-02**: User (any role) can log in with email and password and stay logged in across app restarts (session persisted client-side, refreshable)
- [ ] **AUTH-03**: User can log out, invalidating their session
- [ ] **AUTH-04**: Every API endpoint enforces role-based authorization (`admin`/`mechanic`/`client`) via server-side middleware — no endpoint trusts client-supplied role claims

### Data & Schema

- [ ] **DATA-01**: Server defines and migrates a SQLite schema covering `profiles`, `mechanics`, `public_mechanics`, `timeslots`, `appointments`, `appointment_service_reports`, `appointment_service_items`, `admin_action_log`, `notifications`
- [ ] **DATA-02**: `notifications` table schema is recovered via live introspection against the current Supabase project (no `CREATE TABLE` exists in any repo) before being ported
- [ ] **DATA-03**: `public_mechanics` stays in sync with `profiles`/`mechanics` changes (trigger or equivalent application-level sync), preserving the read-only denormalized-projection behavior

### Booking & Appointments

- [ ] **BOOK-01**: Client can book an available timeslot for a mechanic; concurrent booking attempts on the same timeslot never both succeed (transactional write + unique constraint, replacing Postgres `SELECT…FOR UPDATE` + partial unique index)
- [ ] **BOOK-02**: Client can cancel their own confirmed or unfinalized appointment, freeing the timeslot for rebooking
- [ ] **BOOK-03**: Mechanic can cancel an appointment assigned to them
- [ ] **BOOK-04**: Mechanic can mark an appointment complete, recording a service report (summary, diagnosis, work performed, parts used, recommendations, total amount) with line items
- [ ] **BOOK-05**: Appointment status auto-transitions (`confirmado` → `nao_finalizado` → `acabado`) are computed on read/list, matching current `sync_unfinalized_appointments`/`sync_acabado_appointments` behavior

### Admin Management

- [ ] **ADMIN-01**: Admin can create a mechanic account (auth user + profile + mechanic record) in a single authenticated action, replacing the `admin-create-mechanic` edge function
- [ ] **ADMIN-02**: Admin can delete a mechanic account; the action is recorded in `admin_action_log` with before/after state, replacing the `admin-delete-mechanics` edge function
- [ ] **ADMIN-03**: Admin can retrieve dashboard summary, mechanic list/detail, appointment list/detail, and financial reports via authorized endpoints, replacing the `admin_*` reporting RPCs

### Notifications

- [ ] **NOTIF-01**: Booking, cancellation, and completion actions create notification rows visible to the counterpart role (client ↔ mechanic), matching current fan-out behavior
- [ ] **NOTIF-02**: User can list their own notifications and mark them read

### Infrastructure

- [ ] **INFRA-01**: Server is a portable Node process configured entirely via environment variables (SQLite file path, port, JWT secret) with no hosting-platform-specific code
- [ ] **INFRA-02**: Server runs locally against a local SQLite file for development, with a documented setup/run command

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Authentication

- **AUTH-05**: Phone/SMS OTP signup and login (dropped for this migration; own Twilio integration required if reintroduced)

### Data

- **DATA-04**: Production data migration from the live Supabase project (uuid/timestamptz/jsonb → SQLite transform, row-count/integrity verification)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Realtime subscriptions (websocket push) | Not used anywhere in current apps (verified zero usages); cross-app visibility handled via polling/refetch as today |
| File/object storage | Not used anywhere in current apps |
| Concrete hosting/deployment target | Deliberately deferred — server built hosting-agnostic |
| Client app UI/screen changes | Only the `services/*.ts` + `app/_layout.tsx` layer in each sibling app talks to this backend; rewiring those happens in each app's own repo, out of scope for this project |
| `tests-e2e/` repointing | Downstream dependency on this server existing, but its own separate effort |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| DATA-01 | TBD | Pending |
| DATA-02 | TBD | Pending |
| DATA-03 | TBD | Pending |
| BOOK-01 | TBD | Pending |
| BOOK-02 | TBD | Pending |
| BOOK-03 | TBD | Pending |
| BOOK-04 | TBD | Pending |
| BOOK-05 | TBD | Pending |
| ADMIN-01 | TBD | Pending |
| ADMIN-02 | TBD | Pending |
| ADMIN-03 | TBD | Pending |
| NOTIF-01 | TBD | Pending |
| NOTIF-02 | TBD | Pending |
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 0 (pending roadmap creation)
- Unmapped: 19 ⚠️ (expected pre-roadmap)

---
*Requirements defined: 2026-08-07*
*Last updated: 2026-08-07 after initial definition*

# Roadmap: Workshop Backend Server (Supabase Replacement)

## Overview

This roadmap delivers a self-hosted Node.js + SQLite backend that replaces the shared Supabase
project behind three sibling Expo apps (`admin`, `mechanic`, `oficina`). It follows a Vertical
MVP structure: Phase 1 stands up a thin, fully-working "walking skeleton" (portable server, full
schema, working auth) so every later phase builds on a provably-working foundation rather than
stacking unverified layers. Phase 2 delivers the project's actual core value end-to-end —
role-gated booking, cancellation, and completion without double-booking. Phase 3 adds admin
account management and reporting. Phase 4 closes the loop with cross-app notification visibility,
completing parity with the current Supabase+Postgres system's booking/notification guarantees.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Auth Walking Skeleton** - Portable server boots, full schema is migrated, and a client can sign up/log in/log out end-to-end (completed 2026-08-08)
- [ ] **Phase 2: Booking & Appointment Lifecycle** - Clients book timeslots without double-booking; mechanics cancel/complete appointments; every endpoint is role-gated
- [ ] **Phase 3: Admin Management** - Admins create/delete mechanic accounts and retrieve dashboard, mechanic, appointment, and financial reporting data
- [ ] **Phase 4: Notifications & Cross-App Visibility** - Booking-lifecycle events fan out as notifications visible across roles; users manage their notification inbox

## Phase Details

### Phase 1: Foundation & Auth Walking Skeleton

**Goal**: A portable, locally-runnable Node/SQLite server exists with the full schema in place, and a user can sign up, log in with a persisted/refreshable session, and log out — proving the entire stack works end-to-end before any business logic is layered on.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, DATA-01, DATA-02, DATA-03, AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):

  1. A developer can start the server locally against a local SQLite file using a documented setup/run command, with all configuration (DB file path, port, JWT secret) supplied via environment variables and no hosting-platform-specific code.
  2. On startup, the server has migrated the full schema — `profiles`, `mechanics`, `public_mechanics`, `timeslots`, `appointments`, `appointment_service_reports`, `appointment_service_items`, `admin_action_log`, and `notifications` (the `notifications` schema inferred from client-code usage since no `CREATE TABLE` for it exists in any repo and live introspection is not possible — see `01-CONTEXT.md`).
  3. When a `profiles` or `mechanics` record changes, `public_mechanics` reflects that change automatically without a manual sync step.
  4. A client can sign up with email/password, log in and remain authenticated across a simulated app restart (session persists and refreshes), and log out — after which the old session is no longer valid.

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Tracer slice: project scaffold, env-driven config, SQLite/Drizzle wiring, `profiles` table, `GET /health` and `POST /auth/signup` (INFRA-01, INFRA-02, AUTH-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Full schema: the eight remaining tables with ported constraints and indexes, the inferred `notifications` table, and six triggers keeping `public_mechanics` self-syncing (DATA-01, DATA-02, DATA-03)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Session lifecycle: admin bootstrap script, `POST /auth/login`, `GET /auth/me`, auth middleware, and SQLite-backed token blocklist behind `POST /auth/logout` (AUTH-02, AUTH-03)

### Phase 2: Booking & Appointment Lifecycle

**Goal**: Clients can book a mechanic timeslot and mechanics can manage it (cancel, complete) without double-booking, with every endpoint enforcing server-side role authorization — this is the project's core value, delivered end-to-end.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: AUTH-04, BOOK-01, BOOK-02, BOOK-03, BOOK-04, BOOK-05
**Success Criteria** (what must be TRUE):

  1. Every endpoint rejects requests where the caller's role (derived server-side from their authenticated session, never trusted from a client-supplied claim) lacks permission for the action being performed.
  2. A client can book an available timeslot for a mechanic; when two requests race to book the same timeslot, only one succeeds and the other receives a clear conflict response — no double-booking.
  3. A client can cancel their own confirmed or unfinalized appointment, and a mechanic can cancel an appointment assigned to them — either action frees the timeslot for rebooking.
  4. A mechanic can mark an assigned appointment complete while recording a service report (summary, diagnosis, work performed, parts used, recommendations, total amount) with line items.
  5. Appointment status reflects the correct auto-transition (`confirmado` → `nao_finalizado` → `acabado`) whenever an appointment is read or listed, matching current `sync_unfinalized_appointments`/`sync_acabado_appointments` behavior.

**Plans**: TBD

### Phase 3: Admin Management

**Goal**: Admins can manage mechanic accounts and retrieve operational/financial visibility across the workshop, matching the current Supabase edge-function and reporting-RPC behavior.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03
**Success Criteria** (what must be TRUE):

  1. An admin can create a mechanic account (auth user + profile + mechanic record) in a single authenticated action.
  2. An admin can delete a mechanic account, and the deletion is recorded in `admin_action_log` with before/after state.
  3. An admin can retrieve a dashboard summary, mechanic list/detail, appointment list/detail, and financial reports through authorized endpoints.

**Plans**: TBD

### Phase 4: Notifications & Cross-App Visibility

**Goal**: Booking-lifecycle events are visible to the counterpart role as notifications, and users can manage their own notification inbox — preserving cross-app visibility without a realtime layer.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: NOTIF-01, NOTIF-02
**Success Criteria** (what must be TRUE):

  1. When a client books or cancels an appointment, or a mechanic cancels or completes one, a notification row is created and visible to the counterpart role (client ↔ mechanic).
  2. A user can list their own notifications via an authorized endpoint.
  3. A user can mark one of their notifications as read, and that status persists on subsequent reads.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Auth Walking Skeleton | 3/3 | Complete    | 2026-08-08 |
| 2. Booking & Appointment Lifecycle | 0/TBD | Not started | - |
| 3. Admin Management | 0/TBD | Not started | - |
| 4. Notifications & Cross-App Visibility | 0/TBD | Not started | - |

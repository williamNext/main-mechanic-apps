<!-- GSD:project-start source:PROJECT.md -->

## Project

**Workshop Backend Server (Supabase Replacement)**

A self-hosted Node.js API server backed by SQLite that replaces the shared Supabase project currently used by three sibling Expo/React Native apps — `admin`, `mechanic`, and `oficina` (client-facing) — in a car-workshop booking system. It is the single shared backend for all three apps: one database, one auth system, one set of business-logic endpoints, segmented by role (`admin` / `mechanic` / `client`).

**Core Value:** Clients can book a mechanic timeslot and mechanics/admins can manage it without double-booking or losing cross-app visibility (a booking, cancellation, or completion made in one app must be correctly visible to the others) — with the same correctness guarantees the current Supabase+Postgres setup provides, just self-hosted on SQLite.

### Constraints

- **Tech stack**: Node.js server, SQLite as the storage engine (better-sqlite3 + Drizzle ORM recommended) — chosen specifically to replace Postgres/Supabase, not negotiable for this project
- **Compatibility**: Must preserve current multi-role (`admin`/`mechanic`/`client`), multi-app (3 separate Expo apps) shared-backend behavior — no per-device/offline-only architecture
- **Concurrency**: Booking must remain safe against concurrent double-booking of the same timeslot, without Postgres-style row locking
- **Auth surface**: Email+password only for this migration; no phone/SMS OTP
- **Data**: No production data carryover — schema-only port, fresh database
- **Hosting**: Must not hard-code assumptions about a specific host/platform; hosting decision deferred

<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

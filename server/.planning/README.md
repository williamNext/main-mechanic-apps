# Frozen — historical record, not current planning

**Deprecated 2026-08-11.** The GSD workflow was abandoned on this project. Nothing in this directory is maintained, and nothing in it should be treated as the current plan.

It is kept rather than deleted because `phases/01-foundation-auth-walking-skeleton/` is the genuine build record of Phase 1 — how the schema, the `public_mechanics` triggers, the migrations and email/password auth were actually planned, executed and verified between 2026-08-07 and 2026-08-08. That reasoning is worth having when Phase 2 touches the same tables.

## Where the live documents are

| Was here | Is now |
|---|---|
| `REQUIREMENTS.md` | [`../../REQUIREMENTS.md`](../../REQUIREMENTS.md) — salvaged, with the phase mapping corrected |
| `ROADMAP.md` | [`../../PROJECT_CONTEXT.md`](../../PROJECT_CONTEXT.md) §4.2 |
| `PROJECT.md` | `PROJECT_CONTEXT.md` §2, §4, §9 and `REQUIREMENTS.md` |
| `STATE.md` | `PROJECT_CONTEXT.md` §4.2, plus tickets under `.scratch/<phase>/issues/` |
| `config.json` | Nothing — GSD configuration, no longer meaningful |

## Two ways this directory is actively wrong

Both predate the planning session of 2026-08-11 and are the reason it is frozen rather than merely stale:

1. **`ROADMAP.md` has no Phase 1.5.** Its phases run 1 → 2 → 3 → 4, so anything following it goes straight from the completed Phase 1 to booking, skipping the phase that first proves a client can talk to this server at all.
2. **`ROADMAP.md` still has a Phase 4 "Notifications & Cross-App Visibility".** Decision **D-K** dissolved it — the notification UI already exists in `oficina` and `mechanic`, so it is the specification for the table shape, and fan-out belongs inside the Phase 2 transactions that cause it.

`STATE.md` likewise reports `current_phase: 2`, which was true on 2026-08-08 and is not now.

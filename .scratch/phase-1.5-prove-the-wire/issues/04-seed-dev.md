# 04 — `seed:dev` fills an empty database with a believable workshop

**What to build:** A developer runs one command against an empty development database and gets a workshop worth clicking through: a handful of mechanics with Brazilian names and Portuguese specialties, timeslots spread across the next several days, and a client account. Every seeded account has a **known password**, so any role can be logged into by hand on demand.

The database starts empty and there is no production data to import (decision D-L), so this is invention, not migration. It exists because nothing in this product has been visually verifiable for months — the clickable half is what unblocks people. Empty lists make it impossible to tell a broken screen from an empty one.

The script is separate from the vitest fixtures and neither replaces the other: fixtures make the test suite work, `seed:dev` makes the app usable by hand.

Two safety properties matter more than the data itself. Re-running the script must be safe — either idempotent or explicitly destructive, but never leaving a half-seeded database behind after an interrupted run. And it must refuse to run when `DB_PATH` does not point at a development database, so it can never overwrite something that matters.

Passwords are hashed through the same path the signup endpoint uses, so a seeded account can actually log in. Follow the existing `seed:admin` script as the pattern.

**Blocked by:** None — can start immediately.

**Status:** done — landed in d1d7c88

- [x] `npm run seed:dev` populates an empty development database in one command
- [x] Seeded mechanics have Brazilian names and Portuguese specialties
- [x] Seeded timeslots fall across several upcoming days
- [x] A client, a mechanic and an admin account each exist with a documented known password
- [x] A seeded account can log in through `POST /auth/login`
- [x] Running the script twice leaves the database in the same state as running it once
- [x] Interrupting the script never leaves a partially seeded database
- [x] The script exits with an error, changing nothing, when `DB_PATH` is not a development database
- [x] The known passwords are documented where a developer will find them

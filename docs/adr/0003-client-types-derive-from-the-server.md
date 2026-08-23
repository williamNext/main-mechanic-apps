# ADR 0003: Client Types Derive From the Server

## Status

Accepted

## Context

Before Phase 4, each of the three Expo apps declared its own `types/models.ts` — a hand-mirrored
copy of every shape the server sends or accepts. The three copies had already drifted: `admin`
wrote several nullable fields as `string | undefined` where `oficina` and `mechanic` wrote
`string | null` for the same server column, and `admin`'s `AdminServiceItem` duplicated `oficina`'s
`ServiceItem` under a different name. Nothing enforced agreement between a hand-written client type
and the server shape it claimed to describe; a server response shape could change with zero
client-side compile error, the same failure mode `@main-mechanic/wire-client` (ADR 0002) had
already closed for the transport layer, one level up the stack.

Three approaches were viable. **Continue hand-mirroring**, accepting drift as a permanent cost.
**Generate client types from an OpenAPI/JSON-Schema export**, adding a build step and a schema
description language this project does not otherwise use. **Derive client types directly from the
server's own zod validators and TypeScript return types**, using `z.input`/`z.output` and
`ReturnType` inference, with the server naming the resulting aliases in one module. The third
option was chosen: it needs no new dependency, no build step, and no schema description
language — the server's existing validators and serializers already are the schema.

The decision is hard to reverse once adopted. Once `server/src/api-types.ts` is the named surface
and three apps import from it, reverting means re-authoring every client type by hand again and
deliberately reintroducing the possibility of drift — not a `package.json` change, a services-wide
rewrite. It also surprises a reader who expects a client repository to own its own types outright.
Both properties, plus the real rejected alternatives above, are why this decision gets an ADR and
the sibling theme-package extraction (Phase 4's other track) does not: the theme package repeats
ADR 0002's reasoning with different files and is easy to reverse — copy one file back into three
apps.

## Decision

Every type that crosses or approaches the client/server boundary is exactly one of four kinds,
defined in `CONTEXT.md`: **wire type** (a response shape, server-owned), **request type** (a
request body or query, server-owned, validated at run time), **view model** (a client-composed
shape with no server equivalent, client-owned), or **app-local type** (used by exactly one app).
Wire and request types are always derived, never hand-written; view models are always
hand-written, never derived, because deriving one from a validator would falsely narrow it (see
`AdminFilters` below).

**One server module, `server/src/api-types.ts`, names every client-facing shape.** It resolves all
`z.input<...>` and `ReturnType<...>` inference server-side and exports plain type aliases. Request
types derive from `z.input`, never `z.output`/`z.infer` — `z.output` is what a handler receives
after defaults, coercions and transforms; a client constructs the input, before those apply. The
admin filter validator coercing query strings to numbers and defaulting `page`/`pageSize` is a
concrete case where deriving from the output would force a client to send values it should be
omitting.

**`@main-mechanic/types` (`packages/types`) imports from `api-types.ts` and nowhere else inside
`server/`**, and re-exports three named groups from one barrel — wire types, request types, and
six hand-written view models (`User`, `Mechanic`, `AdminUser`, `PaginatedResult<T>`,
`CompleteAppointmentInput`, `AdminFilters`). The package declares no `zod` and no `drizzle-orm`
dependency and contains no inference expression of its own.

**`AdminFilters` is the clearest case for why view models and request types cannot be merged into
one kind.** `admin` holds it as fully-defaulted client state — a store holds it, `from` and `to`
are always populated because the client already applied its own defaults. The server's validator
makes both optional, because the server applies its own defaults independently. Deriving the view
model from the validator would make `filters.from` `string | undefined` and break every consumer
that reads it as a plain string. So it splits: `AdminFilterQuery` derives from the validator (what
may be sent), `AdminFilters` derives from the server's already-exported `AdminFilters` *interface*,
not the schema (the fully-defaulted state the client actually holds).

**Nullability is never adjusted by hand.** Where the server sends `T | null`, the client type is
`T | null` — absent means the key is missing, null means known-empty. The six derived response
types carry 81 fields between them, 39 nullable; normalising each to `undefined` at a boundary was
rejected because it adds run-time code to a phase that ships types only, and destroys a distinction
the admin endpoints rely on to tell "never collected" apart from "not yet closed."

**A `server/**` change re-runs all three app typechecks.** Before this decision, `.github/workflows/ci.yml`
defined a `server` path filter that no app job referenced — a server-only commit changing a
serializer's return shape triggered the server test suite and zero app typechecks. Without this
gate, the whole point of deriving types is defeated: a shape change breaks the derivation silently,
one level below where hand-mirroring used to break silently. Each of the three app jobs' `if:`
condition now includes `needs.changes.outputs.server == 'true'`, the same shape of cross-boundary
CI edge Phase 3b (ADR 0002) added for `packages/**`.

## Consequences

**Exporting plain type aliases does not isolate the client-side dependency graph, and this
arrangement's safety rests on having measured that, not on a `package.json` omission.** With every
alias resolved server-side inside `api-types.ts`, an app's `tsc --noEmit --listFiles` still loads
`drizzle-orm`'s and `zod`'s declaration files out of `server/node_modules`, because a TypeScript
type alias is lazy and no build step creates a `.d.ts` boundary between the server and the package
(raw-source workspace consumption, per ADR 0002, applies here too). This was verified by direct
probe before the package was built, not assumed: an app's typecheck against a stub import resolved
clean, exit 0, even through a route module that itself reaches `fastify` and `node:crypto`. What
the arrangement actually delivers is **authorship containment, not graph isolation**: the types
package contains no inference expression and declares no `zod`/`drizzle-orm` dependency, so there
is no source inside it a zod major version bump can break, and no place a client-side author is
invited to write validator code. A future maintainer who assumes the client dependency graph is
clean of server internals because the package's own `package.json` looks clean would be wrong, and
should re-run the same stub-import probe rather than trust the manifest.

The CI gate is what makes derivation an **enforced guarantee** rather than a **convention**. Without
`needs.changes.outputs.server == 'true'` wired into all three app jobs, a server-only commit could
still change a response shape with no client-side signal until someone happened to run an app
typecheck by hand — the exact failure mode this decision exists to close, recreated one layer down.

Reverting this decision is not a per-file change. It means re-authoring `User`, `Mechanic`,
`AdminUser`, and every wire and request type by hand again, in three apps, with no compiler check
that any of them still matches what the server sends — deliberately reintroducing the drift this
ADR exists to prevent.

Two hand-mirrors survive on purpose and are not a failure of this decision. `LoginInput` and
`RegisterInput` have server validators, but every app's auth service takes positional parameters
(`login(email, password)`; `signUp(name, email, password)` in `oficina` only) — adopting the
derived types would mean a services signature refactor, not a type extraction, so it is left for a
later phase. Their validators are exported from `api-types.ts` regardless. `UpdateProfileInput` is
not in this category — its consumers were already object-shaped, so it is adopted.

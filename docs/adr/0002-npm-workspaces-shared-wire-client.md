# ADR 0002: npm Workspaces and a Shared Wire Client

## Status

Accepted

## Context

The three Expo apps entered Phase 3b with separate installs and lockfiles and with drifted copies of the same HTTP client, error-message map, and secure-storage adapter. Four packaging approaches were viable: npm workspaces, per-app `file:` dependencies, a TypeScript path alias, or a canonical copy propagated by a sync script. The repository also contains `tests-e2e` and a Node/SQLite `server` with its own deployment, Vitest and Drizzle toolchain, and 340 passing tests.

The conversion is hard to reverse. One root lockfile now covers four explicit workspace members, the `packages/*` glob, and three separate app deploy targets. Returning to per-app installs would require reconstructing three independent app lockfiles and their CI install paths.

## Decision

The repository uses npm workspaces for `packages/*`, `oficina`, `mechanic`, `admin`, and `tests-e2e`. One root install and lockfile cover those members, and `@main-mechanic/wire-client` exposes raw TypeScript source consumed directly by all three Expo apps. Workspaces were chosen because npm, TypeScript, and Metro then share one dependency graph; `file:` dependencies retain separate lockfiles, a path alias can satisfy TypeScript without satisfying Metro, and a sync script preserves copy drift.

`server/` remains outside the workspace with its own install and lockfile. It has an independent runtime, deployment, and tested toolchain, and it does not consume the shared package, so hoisting its dependencies adds risk without benefit. The package's only cross-boundary edge is an `import type` of server error codes, which is erased before runtime resolution.

No `metro.config.js` was written. `@expo/metro-config`'s `getDefaultConfig()` already derives `watchFolders` and `nodeModulesPaths` from the root `workspaces` globs; executing the installed function confirmed that it includes every workspace member, including `packages/wire-client`, and excludes `server/`. A hand-written Metro configuration would duplicate this derived layout as a second, driftable source of truth and could accidentally watch less than Expo's default.

## Consequences

A fresh clone needs two installs: one root `npm ci` for the client workspace and one inside `server/`. Client dependency versions and one lockfile are managed at the root, while each app retains its own deploy configuration. Changes to the shared package can affect all three deploy targets and must pass package checks, app typecheck and lint, and native Expo bundle verification.

The former app-owned HTTP clients, error maps, and secure-storage adapters are removed. `oficina/config/env.ts` remains only as a thin re-export. Reverting the workspace conversion is no longer a package.json-only change: it requires rebuilding separate app lockfiles and CI install behavior. A future maintainer should add a `metro.config.js` only if verified Expo defaults become insufficient, not merely because generic monorepo guidance recommends one.

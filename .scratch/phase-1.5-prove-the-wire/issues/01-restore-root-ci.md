# 01 — Restore CI at the repository root

**What to build:** Opening a pull request or pushing to `master` runs a secrets scan across the entire monorepo, and runs the `server` typecheck and vitest suite so that a red suite blocks the merge. Today none of this happens: absorbing the four repos moved each app's workflow into a subdirectory, and GitHub only reads `.github/workflows/` at the repository root, so every workflow is inert. gitleaks is not running on a repository that contains all four apps and sits beside four untracked `.env` files holding Supabase keys and the server's `JWT_SECRET`.

A developer should be able to look at a pull request and see checks that genuinely ran. The three per-app workflow files that now look active but never trigger are deleted in the same change — a workflow that appears to protect something and does not is worse than no workflow.

The server jobs are path-filtered so that a change touching only app files does not wait on them.

Per-app `npm ci`, `env:check` and lint jobs are deliberately **not** restored here. The old `eas-build-check` injects the two Supabase secrets that ticket 05 deletes; rebuilding it now would wire CI to credentials that are about to stop existing. Those jobs return once the environment variable swap has settled across all three apps.

**Blocked by:** None — can start immediately. This is the highest-priority ticket in the phase; the repository is currently unprotected.

**Status:** ready-for-agent

- [ ] A single workflow at the repository root triggers on pull requests and on pushes to `master`
- [ ] gitleaks scans the full repository history and fails the run on a finding
- [ ] The `server` typecheck and the `server` vitest suite both run and both fail the run when they fail
- [ ] The server jobs are skipped when a change touches no server files
- [ ] The three per-app `security-and-build.yml` files are deleted
- [ ] No job references `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Verified against a real run on the remote, not just by reading the YAML

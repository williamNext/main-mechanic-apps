# Codebase Concerns

**Analysis Date:** 2026-08-07

## Tech Debt

**Code Duplication in Authorization:**
- Issue: Both `admin-create-mechanic` and `admin-delete-mechanics` functions contain identical `requireAdmin()` implementation and CORS headers dictionary.
- Files: `functions/admin-create-mechanic/index.ts` (lines 12-16, 36-53), `functions/admin-delete-mechanics/index.ts` (lines 7-11, 26-43)
- Impact: Maintenance burden; changes to auth logic must be duplicated. Bug fixes in one function may not propagate to the other.
- Fix approach: Extract shared utilities to a common module (`functions/shared/auth.ts`) with `requireAdmin()` and `corsHeaders` constant. Both functions should import and reuse.

**Overly Permissive CORS Configuration:**
- Issue: CORS header `'Access-Control-Allow-Origin': '*'` on admin-only endpoints allows any origin to make requests.
- Files: `functions/admin-create-mechanic/index.ts` (line 13), `functions/admin-delete-mechanics/index.ts` (line 8)
- Impact: Cross-site request forgery (CSRF) risk if admin auth tokens are compromised in a browser context. Admin endpoints should restrict to specific trusted origins.
- Fix approach: Replace `'*'` with explicit origin allowlist from environment variable (e.g., `Deno.env.get('ALLOWED_ORIGINS')`).

**Incomplete Error Handling on Database Rollback:**
- Issue: In `admin-create-mechanic`, if profile or mechanic insert fails, the function attempts to delete the auth user (line 122), but does not check if the deletion succeeded. Orphaned auth users may remain.
- Files: `functions/admin-create-mechanic/index.ts` (lines 104-124)
- Impact: Database inconsistency. Admin user created but no corresponding profile/mechanic record; auth user cannot be recovered. Cleanup requires manual intervention.
- Fix approach: Check deletion result before returning error. Log deletion failures separately. Consider implementing a compensation/rollback pattern or using Supabase transactions if available.

**Silent Logging Failure in Delete Operation:**
- Issue: In `admin-delete-mechanics`, the `admin_action_log` insert (line 100) is awaited but the result is not checked. If logging fails, deletion proceeds silently without notifying the client.
- Files: `functions/admin-delete-mechanics/index.ts` (line 100)
- Impact: Audit trail gaps. Admin deletion actions may not be logged, breaking compliance and investigative capabilities.
- Fix approach: Check error on log insert. Either fail the entire operation or retry logging before allowing deletion to proceed.

**Inconsistent State After Partial Deletion Failure:**
- Issue: In `admin-delete-mechanics`, auth users are deleted one by one in a loop (line 103-106). If deletion fails for user N but succeeded for users 1-(N-1), the audit log shows all as deleted, but some auth users still exist.
- Files: `functions/admin-delete-mechanics/index.ts` (lines 100-114)
- Impact: Audit log no longer represents actual system state. Admins believe mechanics are deleted when they are still active.
- Fix approach: Collect all deletion results and only insert audit log after all deletions complete successfully. If any fail, roll back and return partial failure details.

## Known Bugs

**Email Validation Regex Too Permissive:**
- Symptoms: Invalid email addresses like `a@b.c` or `admin@localhost` pass validation and are accepted.
- Files: `functions/admin-create-mechanic/index.ts` (line 87)
- Trigger: Submit a form with email addresses containing spaces or missing TLDs (e.g., `user@example`)
- Workaround: Email delivery will fail later when Supabase attempts to send confirmations. User won't receive emails.
- Recommendation: Use a more comprehensive regex or delegate to a library. Current regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` does not validate RFC 5322 properly.

**Phone Normalization Silently Fails for Non-Brazilian Numbers:**
- Symptoms: Phone numbers not in Brazilian format are rejected with `null`, but the error message is generic "missing required fields" rather than "invalid phone format".
- Files: `functions/admin-create-mechanic/index.ts` (lines 29-34, 84)
- Trigger: Submit phone in US format (e.g., `+1 (555) 123-4567`)
- Workaround: None. User cannot create mechanic with non-Brazilian phone number.
- Recommendation: Extend phone normalization to support multiple countries or add country code parameter to request body.

**Password Validation Insufficient:**
- Symptoms: Passwords with length >= 6 are accepted, but no complexity requirements enforced (e.g., `123456` is valid).
- Files: `functions/admin-create-mechanic/index.ts` (line 88)
- Trigger: Create mechanic with password `"123456"`
- Workaround: None; relies on Supabase auth backend to enforce additional rules.
- Recommendation: Add complexity requirements (uppercase, lowercase, numbers, symbols) before sending to Supabase.

## Security Considerations

**No Rate Limiting on Admin Endpoints:**
- Risk: Attackers who compromise an admin token could perform brute-force bulk deletions or creations without throttling.
- Files: `functions/admin-create-mechanic/index.ts`, `functions/admin-delete-mechanics/index.ts`
- Current mitigation: None visible in code. Relies entirely on Supabase auth token security.
- Recommendations: 
  - Implement per-user rate limiting (e.g., max 10 creates/minute, max 100 deletes/minute).
  - Log rate limit rejections for anomaly detection.
  - Consider requiring secondary confirmation (email/OTP) for bulk operations.

**No Request Size Limits:**
- Risk: `admin-delete-mechanics` accepts `mechanicIds` array with no upper bound until line 69 (> 100). A malformed client could send millions of UUIDs, consuming memory.
- Files: `functions/admin-delete-mechanics/index.ts` (lines 67-69)
- Current mitigation: Hard limit of 100 mechanics per request.
- Recommendations:
  - Add explicit Content-Length header validation before parsing JSON.
  - Set Deno runtime memory limits.
  - Log attempts to send oversized requests.

**Missing Validation of Phone and Email Formats Before Database Insertion:**
- Risk: If validation is weak, malformed phone/email reaches database and breaks downstream phone/SMS/email workflows.
- Files: `functions/admin-create-mechanic/index.ts` (lines 79, 87-88)
- Current mitigation: Basic regex for email; phone format conversion.
- Recommendations:
  - Use dedicated libraries for phone validation (e.g., `libphonenumber-js`).
  - Use RFC 5322 compliant email validation or delegated verification (send test email).

**Cleartext Passwords in Transit:**
- Risk: Function receives password in request body over HTTPS. If TLS is misconfigured or HTTPS not enforced, passwords could be intercepted.
- Files: `functions/admin-create-mechanic/index.ts` (line 80)
- Current mitigation: HTTPS enforcement should be handled by Supabase platform.
- Recommendations:
  - Document requirement for HTTPS-only Supabase functions.
  - Consider async password reset flow instead of accepting passwords in creation request.

## Performance Bottlenecks

**Sequential User Deletion in Bulk Delete Operation:**
- Problem: Deleting up to 100 mechanics one at a time in a loop (line 103-106) could take 10+ seconds if each deletion takes 100ms.
- Files: `functions/admin-delete-mechanics/index.ts` (lines 103-106)
- Cause: No parallelization; each `adminClient.auth.admin.deleteUser()` is awaited sequentially.
- Improvement path: Use `Promise.all()` to delete up to 10 users in parallel, batching in waves if needed. Trade-off: less granular error tracking, but much faster completion.

**Potential N+1 Query Pattern:**
- Problem: Line 71-75 fetches profiles with related mechanics via single query, but this assumes the ORM supports nested relations efficiently.
- Files: `functions/admin-delete-mechanics/index.ts` (lines 71-75)
- Cause: Supabase PostgREST supports nested relations, but if not optimized, could degrade with large datasets.
- Improvement path: Verify query plan via `EXPLAIN ANALYZE` in Supabase dashboard. If slow, consider fetching profiles and mechanics separately.

**No Connection Pooling Configuration:**
- Problem: Each function invocation creates a new Supabase client. If many concurrent requests occur, database connection pool could be exhausted.
- Files: `functions/admin-create-mechanic/index.ts` (line 63), `functions/admin-delete-mechanics/index.ts` (line 53)
- Cause: Client created fresh per request; no reuse across invocations.
- Improvement path: Pre-create client instance at module level (persists across requests in Deno runtime). Measure database connection pool usage in Supabase dashboard.

## Fragile Areas

**Authorization Logic Interdependent with Database State:**
- Files: `functions/admin-create-mechanic/index.ts` (lines 36-53), `functions/admin-delete-mechanics/index.ts` (lines 26-43)
- Why fragile: `requireAdmin()` performs 2 database queries (auth lookup + profile lookup). If profiles table schema changes or role enum values change, both functions break silently.
- Safe modification: 
  1. Write integration tests that exercise authorization with various profile states.
  2. Use TypeScript strict types for role values (enum).
  3. Add logging to track permission check failures.
  4. Document which profile fields are critical.
- Test coverage: No visible test files in repo. Authorization logic has no test coverage.

**Cascade Delete Assumption:**
- Files: `functions/admin-delete-mechanics/index.ts` (line 104)
- Why fragile: Code assumes deleting an auth user does not delete profiles/mechanics records (because they are kept for audit log). If Supabase triggers or foreign keys change, this assumption breaks.
- Safe modification:
  1. Verify foreign key constraints in database schema (should NOT cascade delete profiles).
  2. Add data consistency test: delete a mechanic, verify profile still exists.
  3. Document cascade delete strategy clearly.

**Hardcoded Field Names and Values:**
- Files: `functions/admin-create-mechanic/index.ts` (lines 106-110, 115-119), `functions/admin-delete-mechanics/index.ts` (lines 84-86)
- Why fragile: If column names change in `profiles` or `mechanics` tables, or if `admin_action_log` schema changes, inserts will fail with generic database error.
- Safe modification:
  1. Use TypeScript types generated from Supabase schema.
  2. Add migration tests that verify schema assumptions.
  3. Log full error details when insert fails.

## Scaling Limits

**Bulk Deletion Hardcap at 100 Mechanics:**
- Current capacity: Max 100 mechanics per request.
- Limit: If admin needs to delete >100 mechanics (e.g., deactivate entire franchise), requires multiple API calls.
- Scaling path: Remove or increase hardcap, but first parallelize deletion (see Performance section). Test with 1000+ deletes to verify timeout and resource behavior.

**No Pagination Support for Query Results:**
- Current capacity: Fetches all matching mechanics in single query (line 71-75).
- Limit: If >10,000 mechanics exist, query response could exceed network/memory limits.
- Scaling path: Implement cursor-based pagination. Split large deletes into batches with cursor.

**Single Supabase Project Dependency:**
- Current capacity: All functions use single `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Limit: No read replicas or multi-region failover.
- Scaling path: If data volume or request rate grows, migrate to Supabase with read replicas. Or implement queue-based async deletion with retry.

## Missing Critical Features

**No Idempotency Keys:**
- Problem: If client retries a create/delete request due to network timeout, duplicate operations occur (e.g., mechanic created twice).
- Blocks: Safe client retry logic. Financial impact if mechanics are billed per creation.
- Recommendation: Accept `idempotency-key` header, store processed key + result in cache, return cached result on retry.

**No Request Correlation IDs:**
- Problem: When errors occur, logs lack request context. Debugging customer issues requires manual tracing.
- Blocks: Production incident response. Customer support can't link errors to specific API calls.
- Recommendation: Generate `request-id` on entry, include in all logs and error responses.

**No Timeout Handling:**
- Problem: If Supabase database is slow or unresponsive, functions hang indefinitely until Deno runtime timeout (typically 10 minutes).
- Blocks: Predictable error response time. Client can't distinguish network failure from server overload.
- Recommendation: Set explicit timeout on each database operation (e.g., 10 seconds). Return 503 Service Unavailable if exceeded.

**No Async Job Queue:**
- Problem: Bulk deletions block HTTP response. If 100 deletions take 30 seconds, client connection times out.
- Blocks: Async deletion for large batches. Real-time user feedback for long operations.
- Recommendation: Return 202 Accepted with job ID. Poll job status in separate endpoint. Process deletions in background.

## Deferred Implementation Gaps

Per `docs/specs/easy-first-notifications.md`, the following features are deferred and not yet implemented:
- Phone OTP confirmation flow
- Password recovery by phone code
- WhatsApp notification delivery
- SMS fallback for notifications
- Expo push token registration and delivery
- Admin notification template editor
- Notification retention cleanup (180-day policy mentioned but no cron job exists)

**Risk:** Deferred features lack tracking. If notification retention cleanup is never implemented, database will grow unbounded after 180 days.

**Recommendation:** 
- Create GitHub issues for each deferred feature with priority and owner.
- Implement notification cleanup as scheduled function once Supabase scheduled functions become available.
- Add metrics to track notification table size growth.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Input validation (email, phone, password), authorization logic, error handling on database failures.
- Files: `functions/admin-create-mechanic/index.ts`, `functions/admin-delete-mechanics/index.ts`
- Risk: Bugs in validation or auth logic only caught when deployed to production.
- Recommendation: Add test file (e.g., `functions/admin-create-mechanic/index.test.ts`) with vitest or Deno test runner. Cover:
  - Valid and invalid email/phone/password combinations
  - Authorization with admin/non-admin/missing tokens
  - Database failure scenarios (insert failure, delete failure)
  - Edge cases (empty IDs, duplicate IDs, oversized payloads)

**No Integration Tests:**
- What's not tested: End-to-end creation and deletion with real Supabase database; audit log consistency; cascading deletes.
- Files: All functions
- Risk: Schema mismatches or trigger behavior only discovered in staging/production.
- Recommendation: Set up integration test suite that spins up Supabase emulator, seeds test data, calls functions, verifies database state.

**No Load/Stress Tests:**
- What's not tested: Function behavior under high concurrency (100+ simultaneous create/delete requests); timeout handling; memory usage.
- Files: All functions
- Risk: Performance degradation or OOM errors only appear under production load.
- Recommendation: Use k6 or similar tool to simulate sustained load. Test with 1000+ concurrent requests.

---

*Concerns audit: 2026-08-07*

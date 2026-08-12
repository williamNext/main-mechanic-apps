# Codebase Concerns

**Analysis Date:** 2026-08-07

## Tech Debt

**Console Error Logging in Production-Sensitive Code:**
- Issue: `console.error` calls remain in production paths despite security audit findings
- Files: 
  - `utils/secure-storage.ts` (lines 8, 16, 23)
  - `stores/auth-store.ts` (line 62)
  - `app/_layout.tsx` (lines 45, 64)
- Impact: Sensitive authentication or storage errors could be exposed in production logs, particularly in secure storage operations where token or credential issues are handled
- Fix approach: Replace console.error with proper error handling (state storage, error boundaries, or secure logging if needed). Ensure errors don't leak to device logs.

**Widespread Use of TypeScript `any` Type:**
- Issue: Service layer extensively uses `any` type for data mapping, reducing type safety
- Files: 
  - `services/appointment-service.ts` (lines 4, 20, 78, 86, 116, 124, 145 — `mapAppointmentRow` function and data handling)
  - `services/mechanic-service.ts` (lines 12, 35, 46)
  - `services/timeslot-service.ts` (line 4 — `mapSlot` function)
- Impact: Runtime errors in data transformation are not caught at build time; refactoring becomes riskier; IDE autocomplete is disabled
- Fix approach: Create proper TypeScript interfaces for database rows and use type guards or mapper functions with explicit return types

**Hardcoded String Constants in State Management:**
- Issue: Magic string 'cancelado' used directly in appointment cancellation logic
- Files: `stores/appointment-store.ts` (lines 69, 79)
- Impact: Typos in status strings would cause silent bugs; status changes are not centralized
- Fix approach: Extract status constants to `constants/appointment-statuses.ts` or use an enum

**N+1 Query Pattern in Appointment Fetching:**
- Issue: Separate queries for mechanic profiles are run for every appointment after the main appointment query
- Files: `services/appointment-service.ts`
  - `getAllAppointments()` (lines 78-91): Fetches all appointments, then makes separate query for each mechanic
  - `getAppointmentsByClient()` (lines 116-128): Same pattern
- Impact: Database load scales with appointment count; performance degrades as data grows; unnecessary latency
- Fix approach: Use Supabase joins or batch the mechanic profile requests (e.g., in chunks of 50)

**Generic Error Messages Without Context:**
- Issue: Store error handlers catch all errors and set generic Portuguese messages
- Files: 
  - `stores/appointment-store.ts` (lines 30-32, 40-42, 50-52)
  - `stores/timeslot-store.ts` (lines 40-42, 56-58)
  - `stores/notification-store.ts` (lines 34-36, 52-54)
- Impact: Developers cannot distinguish between network timeouts, validation errors, RPC failures, or database errors during debugging
- Fix approach: Create error classification utilities; include error codes and original error details in error state

## Known Bugs

**Incomplete Security Audit Remediation:**
- Symptoms: SECURITY_REPORT.md documents console.error removal, but some console.error calls remain
- Files: `utils/secure-storage.ts`, `stores/auth-store.ts`, `app/_layout.tsx`
- Trigger: Review logs or production monitoring
- Workaround: None; these will leak errors if triggered

**Typos in UI Text and Error Messages:**
- Symptoms: UI text displays 'Notificacoes' (missing accent); error messages have inconsistent spelling
- Files: 
  - `app/(client)/_layout.tsx` (line 40): 'Notificacoes' should be 'Notificações'
  - `stores/notification-store.ts` (lines 35, 53): 'notificacoes' should be 'notificações'
- Trigger: User views app or notifications fail; error messages logged
- Workaround: None; typos persist in UI and logs

**Potential RPC Failure Not Caught:**
- Symptoms: Special case for `book_client_appointment` RPC errors, but other RPC calls don't check for missing functions
- Files: `services/appointment-service.ts` (lines 50-53, 186-192, 194-200 for `syncUnfinalizedAppointments`, `cancelClientAppointment`, `cancelMechanicAppointment`)
- Trigger: RPC functions missing from Supabase (e.g., after failed migration)
- Workaround: Check Supabase SQL migrations have been applied

## Security Considerations

**Async Storage Replacement Incomplete:**
- Risk: While SECURITY_REPORT.md marks AsyncStorage as replaced with expo-secure-store, any lingering AsyncStorage references would expose tokens
- Files: Review `services/api.ts` (which correctly uses SecureStorage) and check for any direct AsyncStorage imports
- Current mitigation: API layer correctly uses SecureStorage for all auth operations
- Recommendations: Audit entire codebase for any remaining `@react-native-async-storage` imports or AsyncStorage references

**Unencrypted Error Logging to Device Console:**
- Risk: SecureStore getItem/setItem/removeItem errors logged to console; could expose that secure storage failed, prompting brute-force attacks
- Files: `utils/secure-storage.ts` (lines 8, 16, 23)
- Current mitigation: None; errors are logged
- Recommendations: Log errors only in development; use error boundaries or monitoring services in production; never log error details

**Sensitive Data in Error Messages:**
- Risk: Auth store catches errors and may expose user identifiers or auth service details
- Files: `stores/auth-store.ts` (line 62 — logs caught error)
- Current mitigation: Error is caught but still logged with console.error
- Recommendations: Strip sensitive fields from errors before storage; use error codes instead of full error messages

## Performance Bottlenecks

**Multiple Mechanic Profile Queries Per Appointment List:**
- Problem: For every fetch of appointments (getAllAppointments, getAppointmentsByClient), a separate profile query runs for all mechanics involved
- Files: `services/appointment-service.ts` (lines 78-91, 117-128)
- Cause: Supabase nested joins have issues with mechanics relationship; workaround fetches profiles manually
- Improvement path: Use batch queries or Supabase stored procedures; alternatively, denormalize mechanic name/phone into appointments table

**Inefficient Cache Invalidation:**
- Problem: Any timeslot or appointment mutation invalidates entire cache; no granular invalidation
- Files: `stores/appointment-store.ts` (lines 57, 66), `stores/timeslot-store.ts` (lines 63, 71-72, 81)
- Cause: Simple cache TTL and binary invalidate method doesn't support partial updates
- Improvement path: Implement per-mechanic or per-date cache keys; merge new appointments into existing state instead of full refresh

**Polling Without Backoff:**
- Problem: `setTimeout(..., 0)` in `app/_layout.tsx` (line 67) schedules profile load immediately without rate limiting
- Files: `app/_layout.tsx` (line 67)
- Cause: Rapid auth state changes could trigger many profile loads in succession
- Improvement path: Debounce profile loads; implement exponential backoff for failed requests

## Fragile Areas

**Appointment Data Mapping:**
- Files: `services/appointment-service.ts` (lines 20-48 — `mapAppointmentRow`)
- Why fragile: Uses `any` type with many fallback chains (e.g., `report.summary ?? a.service_summary ?? a.serviceSummary`); assumes nested report structure exists
- Safe modification: Write tests for edge cases (null reports, missing fields, malformed data); use TypeScript interfaces for database rows; add assertions for required fields
- Test coverage: No tests exist for appointment mapping

**Auth Session Bootstrapping:**
- Files: `app/_layout.tsx` (lines 37-48)
- Why fragile: Multiple async state updates racing (loadInitialSession, auth state changes, profile loads); `active` flag prevents some race conditions but doesn't cover all paths
- Safe modification: Add integration tests for session recovery scenarios; use abort signals instead of `active` flag
- Test coverage: Only one basic e2e test (status check); no session recovery tests

**Supabase RPC Error Detection:**
- Files: `services/appointment-service.ts` (lines 10-18 — `isMissingBookingRpcError`)
- Why fragile: Error detection relies on string matching against error message/details; future RPC changes could break this
- Safe modification: Use Supabase error codes instead of text matching; document expected error codes
- Test coverage: No tests for error detection function

## Scaling Limits

**Database Query Count:**
- Current capacity: Performs 2-3 queries per appointment list view (appointments + mechanic profiles)
- Limit: Scales linearly with appointment count; 1000 appointments = 1 primary + 50+ mechanic queries
- Scaling path: Implement Supabase joins or stored procedures; add database indexes on appointment.mechanic_id and profiles.id

**Real-Time Notification Sync:**
- Current capacity: Manual fetch operations; no subscription to real-time changes
- Limit: Notifications stale until user manually refreshes; no push notifications
- Scaling path: Implement Supabase Realtime subscriptions; add web push or mobile push notifications

**Browser Storage (Web Build):**
- Current capacity: SecureStore uses native storage on mobile; web fallback unclear
- Limit: Web version may not use secure storage; investigate expo-secure-store web behavior
- Scaling path: Ensure web uses IndexedDB with encryption or implement Supabase session management only (no local storage)

## Dependencies at Risk

**expo-secure-store Platform Coverage:**
- Risk: `expo-secure-store` version 55.0.14; web implementation may not provide same security as native
- Impact: Web users may store tokens insecurely
- Migration plan: Test web implementation; add warning or fallback for web; consider using Supabase Auth exclusively (no local token storage on web)

**Supabase SDK (^2.105.4):**
- Risk: Nested join issues noted in comments; workaround implemented but brittle
- Impact: Upgrade may break the workaround or introduce new issues
- Migration plan: Subscribe to Supabase changelog; test upgrade before deploying; write tests for join queries

**Outdated Dependencies in SECURITY_REPORT:**
- Risk: postcss and other build tools had security vulnerabilities
- Impact: Build process or runtime could be exploited
- Migration plan: Run `npm audit fix`; update package-lock.json; re-run security audit

## Missing Critical Features

**Push Notifications:**
- Problem: No integration for SMS, email, or push notifications when appointments are booked/canceled
- Blocks: Users don't get notified of schedule changes; mechanics miss appointment reminders
- Priority: High — Users will miss appointments without notifications

**Unit and Integration Testing:**
- Problem: Only one minimal e2e test; no unit tests for services, stores, or components
- Blocks: Cannot safely refactor auth flow, appointment mapping, or error handling
- Priority: High — Current changes risk breaking core functionality

**Error Recovery UI:**
- Problem: No retry buttons or error recovery UI when API calls fail
- Blocks: Users stuck on error state; must restart app to recover
- Priority: Medium — Impacts user experience but not core functionality

**Appointment Status Workflow:**
- Problem: Status enum allows invalid transitions (e.g., cancelado → confirmado)
- Blocks: Data integrity issues; status history not tracked
- Priority: Medium — Uncommon but possible with concurrent cancellations

## Test Coverage Gaps

**Service Layer:**
- What's not tested: appointment mapping, auth service login/logout, timeslot queries, RPC error detection
- Files: All files in `services/` directory
- Risk: Data transformation bugs, auth failures, RPC failures silently fail or corrupt state
- Priority: High

**Store Layer:**
- What's not tested: state updates, error handling, cache invalidation, concurrent requests
- Files: All files in `stores/` directory
- Risk: Race conditions in appointment booking, stale cache serving old data
- Priority: High

**Auth Flow:**
- What's not tested: session bootstrapping, auth state changes, token refresh, concurrent login/logout
- Files: `app/_layout.tsx`, `services/auth-service.ts`, `stores/auth-store.ts`
- Risk: Users stuck in logged-out state, tokens not refreshed, race conditions during logout
- Priority: Critical

**App Components:**
- What's not tested: UI rendering under error states, empty states, loading states
- Files: `components/` directory
- Risk: UI crashes on null data, incomplete loading states
- Priority: Medium

---

*Concerns audit: 2026-08-07*

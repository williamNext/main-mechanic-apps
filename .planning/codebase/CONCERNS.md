# Codebase Concerns

**Analysis Date:** 2026-08-07

## Tech Debt

**Inconsistent Error Handling in Store Mutations:**
- Issue: Query methods in stores (like `fetchByMechanic`, `fetchAvailable`) have try-catch with error state updates, but mutation methods (like `addSlot`, `toggleAvailability`, `removeSlot`, `markRead`, `markAllRead`) throw directly without catching or setting error state.
- Files: `stores/appointment-store.ts`, `stores/timeslot-store.ts`, `stores/notification-store.ts`, `stores/auth-store.ts`
- Impact: Inconsistent error handling makes it difficult to implement reliable error UI patterns. Developers must remember which methods throw vs which set error state.
- Fix approach: Standardize all store methods to either consistently throw or consistently set error state. Recommended: add try-catch to all mutation methods and set error state like query methods do.

**Fire-and-Forget Async Operations:**
- Issue: Multiple places use `void` keyword on async operations without error handling (lines 58-59, 68, 78 in `stores/appointment-store.ts`; line 59 in `stores/appointment-store.ts`).
- Files: `stores/appointment-store.ts` (lines 58-59, 68, 78), `app/_layout.tsx` (lines 58-59, 72)
- Impact: Failures in `invalidateCache()` or `fetchUnreadCount()` silently fail. Cache invalidation failures mean stale data. Notification count failures mean UI shows wrong state.
- Fix approach: Catch errors from all async operations. For cache invalidation, decide if failures should propagate to user or just log. For notifications, log errors and consider providing user feedback.

**Optimistic State Updates Without Verification:**
- Issue: Stores update state immediately after async call without waiting for backend confirmation. If backend call fails but state was already updated, UI shows wrong data until next refresh.
- Files: `stores/timeslot-store.ts` (lines 62-63, 69-72, 79-81), `stores/appointment-store.ts` (lines 70-71, 79-80, 87-102), `stores/notification-store.ts` (lines 47-54, 61-62)
- Impact: Users may see operations succeed in UI but fail on backend. Refreshing may show inconsistent state. Slot deletions shown as deleted but still exist on backend.
- Fix approach: Revert state on error. Wrap mutations in try-catch, and on error, revert optimistic update to previous state.

## Known Bugs

**Environment Variable Runtime Crashes:**
- Symptoms: App crashes at startup if EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY are not set
- Files: `config/env.ts` (lines 9-10)
- Trigger: Missing env vars during build or runtime
- Current handling: Crashes with TypeError when trying to use env values
- Fix approach: Validate env vars exist at module load time. Throw with clear error message: `if (!process.env.EXPO_PUBLIC_SUPABASE_URL) throw new Error('EXPO_PUBLIC_SUPABASE_URL must be set')`

**Database Profile Fetch Without Error Handling:**
- Symptoms: App crashes if mechanic profile not found when completing appointment
- Files: `services/appointment-service.ts` (lines 185-189 - uses `.single()` which throws if no row)
- Trigger: Booking appointment when mechanic profile deleted (edge case)
- Workaround: None currently
- Fix approach: Use `.maybeSingle()` instead of `.single()` and handle null case explicitly

**Potential Null Reference in AppointmentCard Type Casting:**
- Symptoms: Potential runtime error if appointment.status doesn't match any key in statusTheme object
- Files: `components/ui/AppointmentCard.tsx` (line 23)
- Trigger: Status value not defined in statusTheme or typo in status enum
- Current handling: Falls back to statusTheme.confirmado with type casting
- Fix approach: Add explicit type guard or pre-validate status value before rendering

## Security Considerations

**Supabase Anonymous Key Exposure:**
- Risk: EXPO_PUBLIC_SUPABASE_ANON_KEY is public (as designed by Supabase), but ensure RLS policies are correctly enforced on backend
- Files: `config/env.ts`, `services/api.ts`
- Current mitigation: Using Supabase's anonymous key correctly for public access; rely on RLS policies
- Recommendations: Audit Supabase RLS policies to ensure mechanics can only see their own data, clients only their own appointments. Verify no sensitive data readable by anonymous users.

**Input Validation Gaps:**
- Risk: Many text inputs lack validation or sanitization before sending to database
- Files: `app/(mechanic)/availability.tsx` (time/date parsing is regex-based but may miss edge cases), `app/(mechanic)/appointment/[id].tsx` (free text fields for summary, diagnosis, etc.)
- Current mitigation: Basic format validation with regex and time range checks
- Recommendations: Add server-side validation in Supabase RPC functions. Implement input length limits and content filters for service notes.

**Missing CSRF Protection (Web Build):**
- Risk: Web build could be vulnerable to CSRF attacks if hosted without proper CSRF tokens
- Files: `app/_layout.tsx`, web configuration
- Current mitigation: Relies on Supabase session tokens
- Recommendations: Verify Vercel/hosting provider applies CSRF protection headers. Test web build with CSRF attack simulation.

## Performance Bottlenecks

**syncUnfinalizedAppointments() Called on Every Query:**
- Problem: `syncUnfinalizedAppointments()` RPC is called at the start of every appointment fetch operation (getAllAppointments, getAppointmentsByClient, getAppointmentsByMechanic)
- Files: `services/appointment-service.ts` (lines 53-56, 59, 98, 135)
- Cause: Defensive sync before every query; designed to catch unfinalized appointments from backend but no caching or debouncing
- Current impact: Multiplies database requests. Fetching appointments 3x calls sync 3x
- Improvement path: Debounce sync to run at most once per minute. Add server-side sync job instead of client-side sync on every query.

**Manual Mechanic Profile Fetch Due to PostgREST Limitations:**
- Problem: Mechanic profiles fetched separately in 2 places instead of joined in single query
- Files: `services/appointment-service.ts` (lines 80-94, 119-125)
- Cause: Workaround for PostgREST nested join issues noted in comment at line 80
- Current impact: Extra round-trip for every getAllAppointments call
- Improvement path: Migrate to Supabase functions (RPC) that join data server-side, or upgrade PostgREST version if issue is fixed upstream.

**Large Component With Excessive State:**
- Problem: `AvailabilityScreen` component (756 lines) manages 10 separate state variables (date, startTime, endTime, formError, saving, pickerVisible, batchDuration, batchCount, batchStartTime, mode)
- Files: `app/(mechanic)/availability.tsx` (lines 146-158)
- Cause: Single/batch mode toggle creates two separate logic paths in one component
- Current impact: Hard to test, hard to maintain, potential for state inconsistencies
- Improvement path: Extract into separate components or custom hook. Create SlotsManager component for single/batch logic.

## Fragile Areas

**Timezone/Date Handling Without Validation:**
- Files: `app/(mechanic)/availability.tsx` (lines 22-34), `utils/date.ts`
- Why fragile: Date strings passed as "YYYY-MM-DD" format without timezone info. isPastDate() uses localeCompare() which assumes string format. No parsing as Date objects until needed.
- Safe modification: Always validate date format before use. Add unit tests for date comparison edge cases (midnight times, DST transitions). Consider using date-fns consistently.
- Test coverage: No unit tests for date utilities. E2E tests don't cover timezone scenarios.

**Appointment Status String Matching:**
- Files: `app/(mechanic)/appointment/[id].tsx` (lines 56, 142, 190), `components/ui/AppointmentCard.tsx` (line 23)
- Why fragile: Status comparisons use string literals without type safety. Typo in status string silently falls back to default rendering.
- Safe modification: Export status constants or enum. Use type guards for status checks. Add validation when status is assigned.
- Test coverage: No tests for edge cases like unknown status values.

**Error Handling with Generic `any` Types:**
- Files: `app/(mechanic)/availability.tsx` (line 210, 284, 321, 343), `app/(mechanic)/appointment/[id].tsx` (line 72, 118), `services/appointment-service.ts` (lines 22, 81, 89, 119, 127, 157, 182)
- Why fragile: `any` types hide potential null/undefined errors. Error messages from API may not match expected shape.
- Safe modification: Create typed error classes (e.g., `class SlotError extends Error { code?: string }`). Replace `any` with specific types.
- Test coverage: Error scenarios not tested; error message handling not verified.

**Race Conditions in Auth Store:**
- Files: `stores/auth-store.ts` (lines 121-130), `app/_layout.tsx` (lines 33-95)
- Why fragile: Multiple async operations can update user state simultaneously. Example: login() and automatic profile refresh could overwrite each other.
- Safe modification: Use request tracking (like `profileRequestId` in _layout.tsx) in store. Check request ID matches current before updating state. Add abort signals for cancellable requests.
- Test coverage: Concurrent auth operations not tested.

## Scaling Limits

**No Pagination in Appointment Lists:**
- Current capacity: Load entire appointment history at once
- Limit: Once user has >1000 appointments, fetch/render performance degrades
- Files: `services/appointment-service.ts` (lines 58-95, 97-132, 134-162)
- Scaling path: Add `limit` and `offset` parameters. Implement infinite scroll or page-based navigation in UI components.

**Cache Invalidation Design:**
- Current capacity: Manual cache invalidation by resetting fetchedAt/fetchKey
- Limit: If multiple screens invalidate cache simultaneously, multiple overlapping fetches possible
- Files: `stores/timeslot-store.ts` (lines 85-87)
- Scaling path: Implement debounced cache invalidation. Track pending requests to deduplicate.

## Dependencies at Risk

**react-native-url-polyfill Needed for Web:**
- Risk: Package added to satisfy web platform requirements (line 56 in `package.json`). If upstream polyfill breaks, web build breaks.
- Impact: Web app cannot run without this polyfill
- Migration plan: Monitor Fetch API support across target browsers. When baseline browser versions support URL natively, remove polyfill.

**Expo 54 - Near End of Support:**
- Risk: Expo SDK 54 will reach end of support in ~2025 (current latest is 51+). Framework updates needed eventually.
- Impact: Security patches, new React Native features blocked
- Migration plan: Plan upgrade to Expo 55+ within 6 months. Test against latest React Native breaking changes.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Individual utility functions, store logic, service transformations
- Files: `utils/date.ts`, `utils/format.ts`, `services/`, `stores/`
- Risk: Date calculations, money formatting, data mapping errors go unnoticed until user-facing
- Priority: High - utility functions used in critical paths (availability scheduling, payment calculations)

**Minimal E2E Test Coverage:**
- What's not tested: Login flows, appointment cancellation, error scenarios, concurrent operations
- Files: `tests/e2e/availability.spec.ts`, `tests/e2e/closure.spec.ts` (only 2 files)
- Risk: Regressions in auth, appointment booking, or state management not caught before production
- Priority: High - auth and booking are critical user journeys

**No Integration Tests for Store + Service Interaction:**
- What's not tested: Error handling in store methods, state rollback on failure, cache invalidation timing
- Risk: Store error handling logic changes silently break UI error display
- Priority: Medium - integration layer has consistency issues (per Tech Debt section)

**No Error Scenario Testing:**
- What's not tested: Network failures, timeout handling, missing data, concurrent mutations
- Risk: App behavior under error conditions unknown
- Priority: Medium - critical for user experience but harder to set up

---

*Concerns audit: 2026-08-07*

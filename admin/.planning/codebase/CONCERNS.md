# Codebase Concerns

**Analysis Date:** 2026-08-07

## Tech Debt

**Monolithic Component Library:**
- Issue: `components/ui/AdminControls.tsx` (758 lines) contains 13+ independent UI components mixed together with shared styles object
- Files: `components/ui/AdminControls.tsx`
- Impact: Difficult to test individual components, unclear dependencies, changes to one component risk breaking others, large file difficult to navigate and maintain
- Fix approach: Split into separate files: `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Calendar.tsx`, etc. Create a barrel file if needed for convenience imports

**Oversized Page Components:**
- Issue: Page components exceed 500+ lines each (`app/(admin)/mechanics/index.tsx` is 536 lines, `app/(admin)/finance.tsx` is 504 lines)
- Files: `app/(admin)/mechanics/index.tsx`, `app/(admin)/finance.tsx`
- Impact: Mixing business logic, UI layout, and state management in one file makes testing, refactoring, and understanding flow difficult
- Fix approach: Extract modal logic into separate components; extract form handling into custom hooks; extract data transformation into utility functions

**Hardcoded Color Values:**
- Issue: Colors duplicated throughout codebase (e.g., `#101828`, `#667085`, `#b42318` appear in multiple files)
- Files: `components/ui/AdminControls.tsx` (40+ color values), `app/(admin)/mechanics/index.tsx`, `app/(auth)/login.tsx`, and others
- Impact: Inconsistent theme updates, difficult to maintain a cohesive design system, high risk of color inconsistencies across the app
- Fix approach: Create a centralized theme system in `constants/theme.ts` and reference it throughout; use a theme hook similar to `use-theme-color.ts`

**Modal State Scattered:**
- Issue: Modal open/close state and form data managed at component level instead of in stores
- Files: `app/(admin)/mechanics/index.tsx` (lines 33-45), `app/(admin)/finance.tsx`
- Impact: Complex local state makes testing harder, difficult to manage multiple modals, state reset logic duplicated
- Fix approach: Move modal and form state into `admin-store.ts` or a dedicated `modal-store.ts`

## Known Bugs

**Potential Race Condition in Auth Initialization:**
- Symptoms: If auth state changes rapidly (e.g., user logs in, logs out, logs back in quickly), stale profile requests may overwrite newer ones
- Files: `app/_layout.tsx` (lines 47-61)
- Trigger: Very rapid auth state changes or network delays in profile loading
- Workaround: The `profileRequestId` request ID pattern does prevent some races, but the `setTimeout(..., 0)` on line 58 is a red flag
- Fix approach: Remove the `setTimeout` delay or use a proper request cancellation system (AbortController)

**No Input Validation on CSV Export:**
- Symptoms: CSV export with special characters or very long strings could produce malformed CSV
- Files: `utils/csv.ts`, `app/(admin)/mechanics/index.tsx` (line 194)
- Trigger: Mechanic names with commas, quotes, or line breaks; exported data with null values
- Workaround: None - relies on backend data quality
- Fix approach: Implement proper CSV escaping; add validation in `csv.ts`

## Security Considerations

**Public Supabase Keys in Environment:**
- Risk: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are exposed in client bundle; anyone can see these values
- Files: `services/api.ts`, `config/env.ts`, `.env.example`
- Current mitigation: Supabase RLS policies control data access; keys are "anon" keys with limited permissions
- Recommendations: 
  1. Document that these keys should have minimal permissions via RLS
  2. Consider implementing a backend proxy for sensitive operations
  3. Add API key rotation plan to deployment docs

**Session Persistence on Device:**
- Risk: `persistSession: true` in `services/api.ts` (line 11) stores auth tokens in AsyncStorage on mobile devices
- Files: `services/api.ts`
- Current mitigation: No additional layer; relies on device security
- Recommendations:
  1. Document device security requirements for production deployments
  2. Consider implementing biometric re-auth for sensitive operations
  3. Add session timeout enforcement (currently relies on Supabase default)

**Password Input Display:**
- Risk: Password field shows/hides via `secureTextEntry` prop, but no indication to user when password is visible
- Files: `app/(admin)/mechanics/index.tsx` (lines 40-45), `app/(auth)/login.tsx` (lines 56-70)
- Current mitigation: `secureTextEntry` prop is enabled
- Recommendations: Add visual indicator (eye icon toggle) for show/hide password state

**No Rate Limiting on API Calls:**
- Risk: Client-side has no rate limiting; user can spam delete operations or search requests
- Files: `stores/admin-store.ts`, `services/admin-service.ts`
- Current mitigation: Only server-side rate limiting (assumed)
- Recommendations: Add client-side debounce/throttle for frequent operations; implement retry logic with exponential backoff

## Performance Bottlenecks

**Large DataTable Without Virtualization:**
- Problem: `components/ui/AdminControls.tsx` DataTable (line 190) renders all rows at once, not just visible ones
- Files: `components/ui/AdminControls.tsx` (DataTable component), `app/(admin)/mechanics/index.tsx` (table usage)
- Cause: React Native rendering of 100+ table rows in a flat array; each row is a complex component
- Improvement path: Implement `FlatList` with virtualization or split large tables into smaller, paginated views

**Chart Rendering Overhead:**
- Problem: `FinanceBarChart` and `MiniBarChart` create Rect SVG elements for every data point; no memoization
- Files: `components/ui/AdminControls.tsx` (lines 271-296, 298-357)
- Cause: Charts are re-rendered on every parent re-render; no `React.memo()` or component splitting
- Improvement path: Memoize chart components; consider using a dedicated charting library that handles virtualization

**No Request Deduplication:**
- Problem: Multiple stores or components can trigger the same API call simultaneously
- Files: `stores/admin-store.ts`, particularly in `fetchMechanics()`, `fetchDashboard()`
- Cause: Each component independently calls fetch functions; no caching or deduplication layer
- Improvement path: Add request deduplication in service layer; implement a caching layer in stores

## Fragile Areas

**Modal Lifecycle Management:**
- Files: `app/(admin)/mechanics/index.tsx` (lines 289-430 estimated), `app/(admin)/finance.tsx`
- Why fragile: Multiple modal states (`confirmOpen`, `createOpen`, form field states) that must be kept in sync; closing modal doesn't always reset form state
- Safe modification: Extract each modal into its own component with isolated state; test modal open/close/submit flows thoroughly
- Test coverage: No unit tests for modal state transitions; only E2E tests cover happy path

**Date Filtering Logic:**
- Files: `app/(admin)/finance.tsx` (lines 23-120 approximately), `features/admin/filter-utils.ts`
- Why fragile: Date parsing with `parseISO()`, date range calculations, and display formatting spread across multiple places; easy to introduce timezone bugs
- Safe modification: Centralize all date logic in `utils/date.ts` with comprehensive tests; use date-fns consistently
- Test coverage: No tests for date edge cases (month boundaries, leap years, DST transitions)

**CSV Export Formatting:**
- Files: `utils/csv.ts`, `app/(admin)/mechanics/index.tsx` (line 194)
- Why fragile: CSV generation doesn't handle special characters or newlines properly; no CSV validation
- Safe modification: Add unit tests for CSV generation with edge cases (names with commas, quotes, line breaks); use a CSV library if complexity grows
- Test coverage: No tests; only used once

## Scaling Limits

**In-Memory Store State:**
- Current capacity: Stores all paginated data in Zustand stores (mechanics, appointments, finance reports, dashboard)
- Limit: If a dashboard query returns 10,000+ rows, memory grows unbounded; no automatic cleanup
- Scaling path: Implement store cleanup on page change; add pagination token-based navigation; consider server-side pagination cursors

**Modal Complexity Without Portals:**
- Current capacity: Modals rendered inline within page components
- Limit: With many modals or deeply nested content, rendering performance degrades
- Scaling path: Use React Native's `Modal` component properly with dedicated modal store; implement portal pattern if moving to web

## Dependencies at Risk

**Unused Dependency: `pg`:**
- Risk: `pg` package (PostgreSQL client) listed in package.json (line 47) but appears unused in codebase
- Impact: Adds unnecessary bundle size; increases attack surface
- Migration plan: Verify it's not used, then remove; all database access should go through Supabase API
- Check: `grep -r "require.*pg\|import.*pg" --exclude-dir=node_modules`

**Old Expo Version:**
- Risk: Expo ~54.0.33 is from mid-2024; newer versions have security patches
- Impact: Potential security vulnerabilities in Expo runtime
- Migration plan: Pin to latest Expo version; test thoroughly after upgrade

**React Native Version Mismatch Risk:**
- Risk: React 19.1.0 with React Native 0.81.5 are not always in lock-step; compatibility issues possible
- Impact: Unexpected behavior during updates
- Migration plan: Monitor React Native releases for React 19 support; test PRs with latest compatible versions

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: 
  - `services/admin-service.ts` - error handling, data transformation
  - `utils/csv.ts` - CSV formatting with edge cases
  - `utils/date.ts` - date parsing and formatting
  - `features/admin/filter-utils.ts` - filter sanitization logic
  - `stores/admin-store.ts` - state updates, error scenarios
- Files: Core business logic lacks test coverage
- Risk: Refactoring critical functions could introduce bugs silently
- Priority: High - add unit tests for all utilities and services

**Limited E2E Test Coverage:**
- What's not tested:
  - Finance report generation
  - Dashboard data accuracy
  - Mechanic detail page
  - Report page
  - Settings (partially)
  - Error scenarios (network failures, server errors)
  - Permission/authorization edge cases
- Files: `tests/e2e/*.spec.ts`
- Risk: User-facing bugs in financial reports, dashboard calculations
- Priority: High - add E2E tests for critical paths (delete, create, finance)

**No Error Boundary Testing:**
- What's not tested: App behavior when components throw errors
- Files: No error boundary component found in `app/_layout.tsx`
- Risk: Unhandled errors crash the app
- Priority: Medium - implement error boundary component and add tests

**No Accessibility Tests:**
- What's not tested: Screen reader support, keyboard navigation
- Files: All files - though accessibility attributes are used (`accessibilityRole`, `accessibilityState`)
- Risk: App may be unusable for users with accessibility needs
- Priority: Medium - add accessibility testing to E2E suite

## Missing Critical Features

**No Error Recovery UI:**
- Problem: When network requests fail, user sees error text but cannot easily retry
- Blocks: Users stuck after network errors
- Suggested approach: Add retry buttons to error states; implement exponential backoff with user-visible feedback

**No Loading Skeleton States:**
- Problem: LoadingState shows generic "Carregando" spinner; data appears to "pop in"
- Blocks: Poor perceived performance
- Suggested approach: Create skeleton screens for tables and dashboard metrics

**No Offline Support:**
- Problem: App requires internet for all operations
- Blocks: Can't work with cached data when offline
- Suggested approach: Implement local SQLite database with offline queue for mutations

**No Request Cancellation:**
- Problem: If user navigates away, pending requests still complete and try to update unmounted components
- Blocks: Potential memory leaks and warning logs
- Suggested approach: Implement AbortController for fetch/RPC calls; cancel on component unmount

---

*Concerns audit: 2026-08-07*

# Testing Patterns

**Analysis Date:** 2026-08-07

## Test Framework

**Runner:**
- Not configured - no test framework currently in use
- Project uses Deno runtime for edge functions

**Assertion Library:**
- Not detected

**Run Commands:**
- No test commands currently available
- Recommended: Use Deno's built-in test runner with `deno test`

## Test File Organization

**Location:**
- No test files found in current codebase
- Recommended pattern: co-locate tests with source files or use `tests/` directory at root level

**Naming:**
- Not established - recommended pattern: `[function-name].test.ts` or `[function-name].spec.ts`

**Structure:**
- Not established - current codebase has no tests

## Test Structure

**Suite Organization:**
- Not implemented

**Patterns:**
- Not established - recommend using Deno's built-in test patterns:
```typescript
import { assertEquals } from 'jsr:@std/assert';

Deno.test('function name', async () => {
  // Test implementation
  assertEquals(actual, expected);
});
```

## Mocking

**Framework:** 
- Not in use - no mocking library detected

**Patterns:**
- Not established - recommend consideration of mocking patterns for:
  - Supabase client (`createClient`)
  - HTTP requests
  - Database operations

**What to Mock:**
- External dependencies: Supabase client, HTTP requests
- Database operations for unit tests
- Authentication flows

**What NOT to Mock:**
- Input validation logic (test with real data)
- Error handling flows (test actual error responses)
- Type checking (test with edge cases)

## Fixtures and Factories

**Test Data:**
- Not implemented

**Location:**
- Recommended: Create `tests/fixtures/` directory for shared test data
- Example fixture location: `tests/fixtures/create-mechanic-body.ts`

## Coverage

**Requirements:** 
- Not enforced - no coverage configuration found

**View Coverage:**
- Use Deno's coverage with: `deno test --coverage=coverage/ && deno coverage coverage/`

## Test Types

**Unit Tests:**
- Not implemented
- Recommended scope: test individual helper functions
  - `cleanText()` - test whitespace trimming, max length enforcement, type coercion
  - `normalizePhoneToE164()` - test phone number formats (various Brazilian formats, edge cases)
  - `uniqueUuidList()` - test UUID validation, deduplication, non-array input
  - Validation logic - email regex, password length, required fields

**Integration Tests:**
- Not implemented
- Recommended scope: test against mock Supabase client
  - Authentication flow (`requireAdmin`)
  - Database insert operations
  - Error handling and rollback on failure (auth user deletion after profile insert fails)
  - CORS header handling

**E2E Tests:**
- Not applicable - edge functions tested via HTTP in deployed environment
- Recommend Supabase deployment with test requests

## Key Testable Concerns

**Authentication & Authorization:**
Files: `functions/admin-create-mechanic/index.ts`, `functions/admin-delete-mechanics/index.ts`
- Both functions implement `requireAdmin()` - should test:
  - Missing Authorization header → 401
  - Invalid token format → 401
  - Valid token but non-admin user → 403
  - Valid admin user → allow access

**Input Validation:**
Files: `functions/admin-create-mechanic/index.ts`
- Phone normalization: test Brazilian phone formats (10 digits, 11 digits with leading 9, with country code)
- Email validation: test regex pattern against edge cases
- Password requirements: test minimum length enforcement
- Required field checking: test all mandatory fields

**Data Transformation:**
Files: `functions/admin-create-mechanic/index.ts`, `functions/admin-delete-mechanics/index.ts`
- Phone to E.164 format conversion
- UUID deduplication and filtering
- Database field mapping (e.g., `is_active` → `isActive`)

**Error Recovery:**
Files: `functions/admin-create-mechanic/index.ts`
- Rollback scenario: if profile insert fails after auth user created, should delete auth user
- Cascade error handling: check all database operations for error propagation

## Current Testing Gap

**What's missing:**
- No test files for either function (`admin-create-mechanic`, `admin-delete-mechanics`)
- No integration test setup for Supabase client mocking
- No validation test suite
- No authentication flow verification

**Risk areas without tests:**
- Phone normalization logic could accept/reject unexpected formats
- Email regex may not match RFC standards
- Rollback on profile insert failure not validated
- Admin authorization check behavior on edge cases (deleted user, role changes)
- CORS header handling not verified
- Database operation error messages may be unclear

**Priority for testing:**
1. **High:** Authentication and authorization (`requireAdmin` function)
2. **High:** Input validation (email, phone, password)
3. **High:** Error recovery (rollback when profile insert fails)
4. **Medium:** Phone normalization edge cases
5. **Medium:** UUID filtering and deduplication
6. **Low:** CORS header responses

---

*Testing analysis: 2026-08-07*

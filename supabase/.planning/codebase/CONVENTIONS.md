# Coding Conventions

**Analysis Date:** 2026-08-07

## Naming Patterns

**Files:**
- Kebab-case for function directories: `admin-create-mechanic`, `admin-delete-mechanics`
- TypeScript files named `index.ts` as entry points

**Functions:**
- camelCase for all function names
- Helper functions use descriptive verbs: `json()`, `cleanText()`, `normalizePhoneToE164()`, `uniqueUuidList()`, `requireAdmin()`

**Variables:**
- camelCase for all variable names: `corsHeaders`, `createMechanicBody`, `authHeader`, `mechanicIds`
- Const references to static configuration: `corsHeaders`, `uuid` (regex pattern)
- Local scope variables are single-purpose and clearly named

**Types:**
- PascalCase for type names: `CreateMechanicBody`, `DeleteMechanicsBody`
- Use TypeScript `type` keyword for union and object types
- Optional fields marked with `?`: `nome?`, `celular?`, `email?`
- Use `unknown` for untrusted input before validation

**Database:**
- snake_case for database column names: `is_active`, `phone_confirm`, `email_confirm`, `user_metadata`, `admin_action_log`, `actor_id`, `target_mechanic_id`, `before_state`, `after_state`
- camelCase conversion when mapping to response objects: `is_active` becomes `isActive`

## Code Style

**Formatting:**
- No explicit formatter configured (no .prettierrc, .eslintrc found)
- Consistent 2-space indentation observed
- Functions organized top-to-bottom: imports → types → constants → helpers → main handler
- Long lines typically wrapped at ~80-100 characters

**Linting:**
- No linting configuration found (no .eslintrc files)
- No lint configuration in deno.json

## Import Organization

**Order:**
1. External SDK/library imports (JSR or npm): `import { createClient } from 'jsr:@supabase/supabase-js@2';`
2. Type definitions and constants
3. Helper functions
4. Main entry point (Deno.serve)

**Path Aliases:**
- Not used; JSR imports used directly: `jsr:@supabase/supabase-js@2`

## Error Handling

**Patterns:**
- Early returns with explicit HTTP status codes
- Type guards with `typeof` checks before operations
- Return tuple pattern with error as first check: `{ data, error } = await ...`
- Check for null/undefined before using values: `if (!token)`, `if (!userId)`, `if (!supabaseUrl || !serviceRoleKey)`
- Graceful degradation for missing fields: `typeof value === 'string' ? value : ''`
- Regex validation for known formats: email pattern `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, UUID pattern, phone number patterns
- Try-catch only for JSON parsing; errors caught and returned with 400 status
- Deletion rollback on error: delete auth user if profile insert fails

**Error responses:**
```typescript
return json({ error: 'error message' }, statusCode);
```

## Logging

**Framework:** console not used in production code

**Patterns:**
- No logging framework detected
- Silent failures or error propagation via HTTP response codes
- All errors returned as JSON with descriptive messages

## Comments

**When to Comment:**
- Minimal commenting observed
- Code is self-documenting through clear function and variable names
- Logic flow is intentional and explicit

**JSDoc/TSDoc:**
- Not used in current codebase

## Function Design

**Size:** 
- Helper functions kept small and focused (3-15 lines typical)
- Main handler organized into phases but kept within one Deno.serve callback

**Parameters:**
- Typed explicitly: `req: Request`, `adminClient: ReturnType<typeof createClient>`, `value: unknown`, `max: number`
- Use `unknown` for untrusted input
- Use specific types for trusted values

**Return Values:**
- Helper functions return early on error: `return { error: json(...) }`
- Success paths return object with data: `return { userId }`
- Main handler always returns Response object

## Module Design

**Exports:**
- Single default export (Deno.serve) at file level
- Helper functions not explicitly exported; they're local scope
- No barrel files or re-exports used

**Barrel Files:**
- Not used in this project

## Validation Patterns

**Input cleaning:**
- `cleanText()`: trims whitespace and enforces max length
- `normalizePhoneToE164()`: validates and formats phone to E.164 standard
- `uniqueUuidList()`: filters for valid UUIDs and deduplicates
- Always validate type before processing: `typeof value === 'string'`
- Use regex for known formats: email, UUID, phone

**Null-safety:**
- Check for missing values before dereferencing: `const userId = userData.user?.id`
- Optional chaining and nullish coalescing used: `data?.user?.id`, `error?.message ?? 'fallback'`

## State Management

**Request-scoped:**
- All state local to request handler function
- Database client (`adminClient`) created fresh per request
- No module-level mutable state
- Supabase client initialized with `persistSession: false, autoRefreshToken: false` for stateless function

---

*Convention analysis: 2026-08-07*

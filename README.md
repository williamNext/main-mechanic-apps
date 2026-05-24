# Oficina Admin

Expo web-first admin console for mechanic approvals, operations dashboard, appointment exploration, and CSV reporting.

## Scripts

- `npm start` starts Expo.
- `npm run web` starts web dev server.
- `npm run build:web` exports static web build for Vercel.
- `npm run lint` runs Expo lint.

## Environment

Use same public Supabase values as client/mechanic apps:

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

Admin access requires a `profiles` row with `role = 'admin'`. Admin accounts are created outside self-signup.

## Supabase

Admin database additions live in `scripts/sql/2026-05-22_admin_operations.sql` and are already applied to project `tegtdwbkxkxauwtliprs`.

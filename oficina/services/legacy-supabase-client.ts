import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Scaffolding for the services Phase 1.5 ticket 05 did not rewire —
// mechanic-service.ts, timeslot-service.ts, appointment-service.ts and
// notification-service.ts still import a Supabase client. `services/api.ts`
// stopped exporting one (it's the plain fetch wrapper now), and the two
// Supabase env vars are gone from `config/env.ts`, so this client is built
// straight from `process.env` and is unauthenticated/non-functional by
// design — these services already fail today against the dead Supabase
// project, and continuing to fail is not a regression. Delete this file
// once every importer above is rewired onto the server.
export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
);

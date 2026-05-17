-- Read-only diagnostics for auth/profile/booking bottlenecks.
-- Run in Supabase SQL editor before applying candidate indexes.

-- Duplicate slots from repeated seed runs. Must be empty before unique slot index.
SELECT
  mechanic_id,
  date,
  start_time,
  end_time,
  count(*) AS duplicate_count
FROM public.timeslots
GROUP BY mechanic_id, date, start_time, end_time
HAVING count(*) > 1
ORDER BY duplicate_count DESC, date, start_time;

-- Data API grants. Missing authenticated grants can break app calls even when RLS is correct.
SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'mechanics', 'timeslots', 'appointments')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- RLS policy inventory.
SELECT
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'mechanics', 'timeslots', 'appointments')
ORDER BY tablename, policyname;

-- Existing indexes.
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'mechanics', 'timeslots', 'appointments')
ORDER BY tablename, indexname;

-- Mechanic browse query.
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.*, m.*
FROM public.profiles p
JOIN public.mechanics m ON m.id = p.id
WHERE p.role = 'mechanic';

-- Available slots query for first active mechanic.
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.timeslots
WHERE mechanic_id = (SELECT id FROM public.mechanics WHERE is_active = true LIMIT 1)
  AND date = current_date
  AND is_available = true
ORDER BY start_time ASC;

-- Client bookings query for first client.
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.appointments
WHERE client_id = (SELECT id FROM public.profiles WHERE role = 'client' LIMIT 1)
ORDER BY date DESC;

-- Mechanic bookings query for first active mechanic.
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM public.appointments
WHERE mechanic_id = (SELECT id FROM public.mechanics WHERE is_active = true LIMIT 1)
ORDER BY date DESC;

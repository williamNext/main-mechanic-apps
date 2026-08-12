-- Repopulate 3 mechanics and their timeslots.
-- Run after app-table rebuild/truncate. Auth users must already exist in Supabase Auth.
-- Supports either email-auth mechanics or phone-auth mechanics.

WITH mechanic_seed AS (
  SELECT *
  FROM (VALUES
    ('mecanico1@example.com', 'João Mecânico', '+5551999990001', 'Motor', 'CREA-123456'),
    ('mecanico2@example.com', 'Pedro Suspensão', '+5551999990002', 'Suspensão', 'CREA-654321'),
    ('mecanico3@example.com', 'Carlos Elétrica', '+5551999990003', 'Elétrica', 'CREA-789012')
  ) AS seed(email, name, phone_e164, specialty, credentials)
),
matched_users AS (
  SELECT
    au.id,
    ms.email,
    ms.name,
    ms.phone_e164,
    ms.specialty,
    ms.credentials
  FROM mechanic_seed ms
  JOIN auth.users au ON lower(coalesce(au.email, '')) = lower(ms.email)
    OR au.phone = ms.phone_e164
)
INSERT INTO public.profiles (id, name, email, role, phone)
SELECT id, name, email, 'mechanic', phone_e164
FROM matched_users
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  phone = EXCLUDED.phone;

WITH mechanic_seed AS (
  SELECT *
  FROM (VALUES
    ('mecanico1@example.com', '+5551999990001', 'Motor', 'CREA-123456'),
    ('mecanico2@example.com', '+5551999990002', 'Suspensão', 'CREA-654321'),
    ('mecanico3@example.com', '+5551999990003', 'Elétrica', 'CREA-789012')
  ) AS seed(email, phone_e164, specialty, credentials)
),
matched_users AS (
  SELECT au.id, ms.specialty, ms.credentials
  FROM mechanic_seed ms
  JOIN auth.users au ON lower(coalesce(au.email, '')) = lower(ms.email)
    OR au.phone = ms.phone_e164
)
INSERT INTO public.mechanics (id, specialty, credentials, is_active)
SELECT id, specialty, credentials, true
FROM matched_users
ON CONFLICT (id) DO UPDATE
SET
  specialty = EXCLUDED.specialty,
  credentials = EXCLUDED.credentials,
  is_active = true;

WITH mechanic_emails AS (
  SELECT *
  FROM (VALUES
    ('mecanico1@example.com', '+5551999990001'),
    ('mecanico2@example.com', '+5551999990002'),
    ('mecanico3@example.com', '+5551999990003')
  ) AS seed(email, phone_e164)
),
matched_mechanics AS (
  SELECT au.id AS mechanic_id
  FROM mechanic_emails me
  JOIN auth.users au ON lower(coalesce(au.email, '')) = lower(me.email)
    OR au.phone = me.phone_e164
  JOIN public.mechanics m ON m.id = au.id
),
slot_days AS (
  SELECT (current_date + day_offset)::date AS slot_date
  FROM generate_series(0, 6) AS day_offset
),
slot_times AS (
  SELECT *
  FROM (VALUES
    ('08:00'::time, '09:00'::time),
    ('09:00'::time, '10:00'::time),
    ('10:00'::time, '11:00'::time),
    ('11:00'::time, '12:00'::time),
    ('13:00'::time, '14:00'::time),
    ('14:00'::time, '15:00'::time),
    ('15:00'::time, '16:00'::time),
    ('16:00'::time, '17:00'::time)
  ) AS times(start_time, end_time)
)
INSERT INTO public.timeslots (mechanic_id, date, start_time, end_time, is_available)
SELECT
  mm.mechanic_id,
  sd.slot_date,
  st.start_time,
  st.end_time,
  true
FROM matched_mechanics mm
CROSS JOIN slot_days sd
CROSS JOIN slot_times st
ON CONFLICT (mechanic_id, date, start_time, end_time) DO UPDATE
SET is_available = EXCLUDED.is_available;

DO $$
DECLARE
  v_found_count INTEGER;
BEGIN
  SELECT count(*)
  INTO v_found_count
  FROM auth.users
  WHERE lower(coalesce(email, '')) IN (
    'mecanico1@example.com',
    'mecanico2@example.com',
    'mecanico3@example.com'
  )
  OR phone IN (
    '+5551999990001',
    '+5551999990002',
    '+5551999990003'
  );

  IF v_found_count < 3 THEN
    RAISE NOTICE 'Only % of 3 mechanic Auth users found. Create missing Auth users first, then rerun this seed.', v_found_count;
  END IF;
END;
$$;

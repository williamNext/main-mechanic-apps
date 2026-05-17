-- DESTRUCTIVE RESET: drops and rebuilds the app schema in public.
-- This does NOT delete Supabase Auth users. It deletes app tables/data:
-- profiles, mechanics, timeslots, appointments.
--
-- Run order in Supabase SQL Editor:
-- 1. Run this full file.
-- 2. Ensure Auth users exist for mechanics/clients.
-- 3. Run scripts/sql/2026-05-16_seed_3_mechanics_timeslots.sql.

BEGIN;

-- 1. Drop old public app objects.
DROP FUNCTION IF EXISTS public.book_client_appointment(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cancel_client_appointment(UUID);
DROP FUNCTION IF EXISTS public.cancel_mechanic_appointment(UUID);
DROP FUNCTION IF EXISTS public.sync_acabado_appointments();

DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.timeslots CASCADE;
DROP TABLE IF EXISTS public.mechanics CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- 2. Tables.
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'mechanic', 'client')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.mechanics (
  id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  specialty TEXT NOT NULL,
  credentials TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE TABLE public.timeslots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mechanic_id UUID REFERENCES public.mechanics(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT timeslots_time_order_check CHECK (end_time > start_time)
);

CREATE TABLE public.appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  mechanic_id UUID REFERENCES public.mechanics(id) ON DELETE CASCADE NOT NULL,
  timeslot_id UUID REFERENCES public.timeslots(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmado', 'cancelado', 'acabado')) DEFAULT 'confirmado',
  vehicle_info TEXT CHECK (char_length(coalesce(vehicle_info, '')) <= 120),
  notes TEXT CHECK (char_length(coalesce(notes, '')) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT appointments_time_order_check CHECK (end_time > start_time)
);

-- 3. Indexes.
CREATE UNIQUE INDEX appointments_one_confirmado_per_timeslot
  ON public.appointments (timeslot_id)
  WHERE status = 'confirmado' AND timeslot_id IS NOT NULL;

CREATE UNIQUE INDEX timeslots_mechanic_date_time_unique_idx
  ON public.timeslots (mechanic_id, date, start_time, end_time);

CREATE INDEX profiles_role_mechanic_idx
  ON public.profiles (role)
  WHERE role = 'mechanic';

CREATE INDEX timeslots_mechanic_date_available_start_idx
  ON public.timeslots (mechanic_id, date, is_available, start_time);

CREATE INDEX appointments_client_date_desc_idx
  ON public.appointments (client_id, date DESC);

CREATE INDEX appointments_mechanic_date_desc_idx
  ON public.appointments (mechanic_id, date DESC);

-- 4. Data API privileges. RLS still controls row access.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.mechanics TO anon, authenticated;
GRANT INSERT, UPDATE ON public.mechanics TO authenticated;

GRANT SELECT ON public.timeslots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.timeslots TO authenticated;

GRANT SELECT ON public.appointments TO authenticated;

-- 5. RLS.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeslots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Mechanics are viewable by everyone"
  ON public.mechanics
  FOR SELECT
  USING (true);

CREATE POLICY "Mechanics can insert own details"
  ON public.mechanics
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Mechanics can update own details"
  ON public.mechanics
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "TimeSlots are viewable by everyone"
  ON public.timeslots
  FOR SELECT
  USING (true);

CREATE POLICY "Mechanics can insert own timeslots"
  ON public.timeslots
  FOR INSERT
  WITH CHECK (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can update own timeslots"
  ON public.timeslots
  FOR UPDATE
  USING (auth.uid() = mechanic_id)
  WITH CHECK (auth.uid() = mechanic_id);

CREATE POLICY "Mechanics can delete own timeslots"
  ON public.timeslots
  FOR DELETE
  USING (auth.uid() = mechanic_id);

CREATE POLICY "Clients can view own appointments"
  ON public.appointments
  FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Mechanics can view assigned appointments"
  ON public.appointments
  FOR SELECT
  USING (auth.uid() = mechanic_id);

CREATE POLICY "Admins can view all appointments"
  ON public.appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- 6. Secure booking/cancellation RPCs.
CREATE OR REPLACE FUNCTION public.book_client_appointment(
  p_timeslot_id UUID,
  p_vehicle_info TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_slot public.timeslots%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF char_length(coalesce(p_vehicle_info, '')) > 120 THEN
    RAISE EXCEPTION 'vehicle info too long';
  END IF;

  IF char_length(coalesce(p_notes, '')) > 1000 THEN
    RAISE EXCEPTION 'notes too long';
  END IF;

  SELECT *
    INTO v_slot
  FROM public.timeslots
  WHERE id = p_timeslot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'timeslot not found';
  END IF;

  IF NOT v_slot.is_available THEN
    RAISE EXCEPTION 'timeslot unavailable';
  END IF;

  IF ((v_slot.date + v_slot.start_time) AT TIME ZONE 'America/Sao_Paulo') <= now() THEN
    RAISE EXCEPTION 'timeslot expired';
  END IF;

  INSERT INTO public.appointments (
    client_id,
    mechanic_id,
    timeslot_id,
    date,
    start_time,
    end_time,
    status,
    vehicle_info,
    notes
  )
  VALUES (
    v_user_id,
    v_slot.mechanic_id,
    v_slot.id,
    v_slot.date,
    v_slot.start_time,
    v_slot.end_time,
    'confirmado',
    nullif(trim(coalesce(p_vehicle_info, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  RETURNING * INTO v_appointment;

  UPDATE public.timeslots
  SET is_available = false
  WHERE id = v_slot.id;

  RETURN v_appointment;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_client_appointment(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_appointment RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id, client_id, status, timeslot_id
    INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found';
  END IF;

  IF v_appointment.client_id <> v_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_appointment.status = 'cancelado' THEN
    RETURN;
  END IF;

  IF v_appointment.status <> 'confirmado' THEN
    RAISE EXCEPTION 'cannot cancel appointment with status %', v_appointment.status;
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado'
  WHERE id = v_appointment.id;

  IF v_appointment.timeslot_id IS NOT NULL THEN
    UPDATE public.timeslots
    SET is_available = true
    WHERE id = v_appointment.timeslot_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_mechanic_appointment(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_appointment RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT id, mechanic_id, status, timeslot_id
    INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'appointment not found';
  END IF;

  IF v_appointment.mechanic_id <> v_user_id THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_appointment.status = 'cancelado' THEN
    RETURN;
  END IF;

  IF v_appointment.status <> 'confirmado' THEN
    RAISE EXCEPTION 'cannot cancel appointment with status %', v_appointment.status;
  END IF;

  UPDATE public.appointments
  SET status = 'cancelado'
  WHERE id = v_appointment.id;

  IF v_appointment.timeslot_id IS NOT NULL THEN
    UPDATE public.timeslots
    SET is_available = true
    WHERE id = v_appointment.timeslot_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_acabado_appointments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.appointments
  SET status = 'acabado'
  WHERE status = 'confirmado'
    AND ((date + end_time) AT TIME ZONE 'America/Sao_Paulo') <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.book_client_appointment(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_client_appointment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_mechanic_appointment(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_acabado_appointments() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.book_client_appointment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mechanic_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_acabado_appointments() TO authenticated;

COMMIT;

-- Force PostgREST to reload exposed tables/functions.
NOTIFY pgrst, 'reload schema';

-- Sanity checks. Expected: four tables + four functions.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'mechanics', 'timeslots', 'appointments')
ORDER BY tablename;

SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'book_client_appointment',
    'cancel_client_appointment',
    'cancel_mechanic_appointment',
    'sync_acabado_appointments'
  )
ORDER BY p.proname;

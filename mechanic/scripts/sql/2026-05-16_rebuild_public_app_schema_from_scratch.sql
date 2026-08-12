-- DESTRUCTIVE RESET: drops and rebuilds the app schema in public.
-- This does NOT delete Supabase Auth users. It deletes app tables/data:
-- profiles, mechanics, timeslots, appointments.
--
-- Run order in Supabase SQL Editor:
-- 1. Run this full file.
-- 2. Ensure Auth users exist for mechanics/clients.
-- 3. Run scripts/sql/2026-05-16_seed_3_mechanics_timeslots.sql.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

-- 1. Drop old public app objects.
DROP FUNCTION IF EXISTS public.book_client_appointment(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cancel_client_appointment(UUID);
DROP FUNCTION IF EXISTS public.cancel_mechanic_appointment(UUID);
DROP FUNCTION IF EXISTS public.sync_acabado_appointments();

DROP TABLE IF EXISTS public.public_mechanics CASCADE;
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
  credentials TEXT NOT NULL DEFAULT 'PENDENTE',
  is_active BOOLEAN DEFAULT false NOT NULL
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

CREATE TABLE public.public_mechanics (
  id UUID PRIMARY KEY REFERENCES public.mechanics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
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

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mechanics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_mechanics FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.mechanics TO authenticated;
GRANT SELECT ON public.public_mechanics TO anon, authenticated;

GRANT SELECT ON public.timeslots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.timeslots TO authenticated;

GRANT SELECT ON public.appointments TO authenticated;

CREATE OR REPLACE FUNCTION private.can_view_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_profile_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND (
      (SELECT auth.uid()) = p_profile_id
      OR EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE (a.client_id = (SELECT auth.uid()) AND a.mechanic_id = p_profile_id)
           OR (a.mechanic_id = (SELECT auth.uid()) AND a.client_id = p_profile_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'admin'
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.enforce_profile_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> NEW.id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    RAISE EXCEPTION 'users cannot self-assign admin role';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'users cannot change their own role';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_profile_role_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_profile_role_guard();

CREATE OR REPLACE FUNCTION private.enforce_mechanic_approval_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> NEW.id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active IS DISTINCT FROM false OR NEW.credentials IS DISTINCT FROM 'PENDENTE' THEN
      RAISE EXCEPTION 'mechanic approval fields are admin-controlled';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.credentials IS DISTINCT FROM OLD.credentials THEN
      RAISE EXCEPTION 'mechanic approval fields are admin-controlled';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_mechanic_approval_guard
  BEFORE INSERT OR UPDATE ON public.mechanics
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_mechanic_approval_guard();

CREATE OR REPLACE FUNCTION private.refresh_public_mechanic(p_mechanic_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.public_mechanics
  WHERE id = p_mechanic_id;

  INSERT INTO public.public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, timezone('utc'::text, now())
  FROM public.profiles p
  JOIN public.mechanics m ON m.id = p.id
  WHERE m.id = p_mechanic_id
    AND p.role = 'mechanic'
    AND m.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_public_mechanic_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_public_mechanic(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM private.refresh_public_mechanic(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_public_mechanic_from_mechanics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_public_mechanic(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM private.refresh_public_mechanic(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER refresh_public_mechanic_from_profile
  AFTER INSERT OR UPDATE OF name, role, avatar_url OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.refresh_public_mechanic_from_profile();

CREATE TRIGGER refresh_public_mechanic_from_mechanics
  AFTER INSERT OR UPDATE OF specialty, is_active OR DELETE ON public.mechanics
  FOR EACH ROW
  EXECUTE FUNCTION private.refresh_public_mechanic_from_mechanics();

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(UUID) TO authenticated;

-- 5. RLS.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeslots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public mechanics are viewable by everyone"
  ON public.public_mechanics
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can view permitted profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (private.can_view_profile(id));

CREATE POLICY "Users can insert own non-admin profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND role IN ('client', 'mechanic'));

CREATE POLICY "Users can update own profile basics"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users can view own mechanic details"
  ON public.mechanics
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert pending own mechanic details"
  ON public.mechanics
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND credentials = 'PENDENTE' AND is_active = false);

CREATE POLICY "Users can update own mechanic profile basics"
  ON public.mechanics
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

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

-- 0. Drop existing tables if re-running
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS timeslots CASCADE;
DROP TABLE IF EXISTS mechanics CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Create tables

CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'mechanic', 'client')),
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE mechanics (
  id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  specialty TEXT NOT NULL,
  credentials TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE timeslots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mechanic_id UUID REFERENCES mechanics(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE appointments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mechanic_id UUID REFERENCES mechanics(id) ON DELETE CASCADE NOT NULL,
  timeslot_id UUID REFERENCES timeslots(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmado', 'cancelado', 'acabado')) DEFAULT 'confirmado',
  vehicle_info TEXT CHECK (char_length(coalesce(vehicle_info, '')) <= 120),
  notes TEXT CHECK (char_length(coalesce(notes, '')) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE UNIQUE INDEX appointments_one_confirmado_per_timeslot
  ON appointments (timeslot_id)
  WHERE status = 'confirmado' AND timeslot_id IS NOT NULL;

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeslots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- 3. Basic RLS Policies (Simplified for MVP)
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Mechanics are viewable by everyone" ON mechanics FOR SELECT USING (true);
CREATE POLICY "Mechanics can update own details" ON mechanics FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Mechanics can insert own details" ON mechanics FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "TimeSlots are viewable by everyone" ON timeslots FOR SELECT USING (true);
CREATE POLICY "Mechanics can manage own timeslots" ON timeslots FOR ALL USING (auth.uid() = mechanic_id);

CREATE POLICY "Clients can view own appointments" ON appointments FOR SELECT USING (auth.uid() = client_id);
CREATE POLICY "Mechanics can view assigned appointments" ON appointments FOR SELECT USING (auth.uid() = mechanic_id);
CREATE POLICY "Admins can view all" ON appointments FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. RPCs for secure booking/cancellation/status sync
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
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND role = 'client'
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

NOTIFY pgrst, 'reload schema';

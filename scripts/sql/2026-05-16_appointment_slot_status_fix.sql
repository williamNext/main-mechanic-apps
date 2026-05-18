-- Idempotent migration for appointment slot ownership, Portuguese statuses,
-- secure booking/cancellation RPCs, and mechanic rating removal.

UPDATE public.appointments
SET status = CASE
  WHEN status IN ('pending', 'confirmed', 'in_progress') THEN 'confirmado'
  WHEN status = 'completed' THEN 'acabado'
  WHEN status = 'cancelled' THEN 'cancelado'
  ELSE status
END
WHERE status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

ALTER TABLE public.appointments
  ALTER COLUMN status SET DEFAULT 'confirmado';

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', v_constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmado', 'cancelado', 'acabado'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_vehicle_info_length_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_vehicle_info_length_check
      CHECK (char_length(coalesce(vehicle_info, '')) <= 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_notes_length_check'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_notes_length_check
      CHECK (char_length(coalesce(notes, '')) <= 1000);
  END IF;
END;
$$;

ALTER TABLE public.mechanics
  DROP COLUMN IF EXISTS rating;

DROP POLICY IF EXISTS "Clients can book appointments" ON public.appointments;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_confirmado_per_timeslot
  ON public.appointments (timeslot_id)
  WHERE status = 'confirmado' AND timeslot_id IS NOT NULL;

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

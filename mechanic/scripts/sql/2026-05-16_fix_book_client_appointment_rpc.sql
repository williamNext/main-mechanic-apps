-- Fix missing PostgREST RPC: public.book_client_appointment(p_timeslot_id, p_vehicle_info, p_notes).
-- Run in Supabase SQL editor, then retry booking.

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

REVOKE ALL ON FUNCTION public.book_client_appointment(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_client_appointment(UUID, TEXT, TEXT) TO authenticated;

-- Force PostgREST to refresh function signatures immediately.
NOTIFY pgrst, 'reload schema';

SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'book_client_appointment';

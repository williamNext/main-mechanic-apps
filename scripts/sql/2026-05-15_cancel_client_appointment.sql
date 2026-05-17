-- Idempotent migration for existing environments:
-- secure RPC for client cancellation + timeslot release.

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

REVOKE ALL ON FUNCTION public.cancel_client_appointment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_client_appointment(UUID) TO authenticated;

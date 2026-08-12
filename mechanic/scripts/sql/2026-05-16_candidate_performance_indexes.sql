-- Candidate performance indexes after diagnostics confirm scans.
-- Safe to rerun. Unique timeslot index is skipped when duplicates exist.

CREATE INDEX IF NOT EXISTS profiles_role_mechanic_idx
  ON public.profiles (role)
  WHERE role = 'mechanic';

CREATE INDEX IF NOT EXISTS timeslots_mechanic_date_available_start_idx
  ON public.timeslots (mechanic_id, date, is_available, start_time);

CREATE INDEX IF NOT EXISTS appointments_client_date_desc_idx
  ON public.appointments (client_id, date DESC);

CREATE INDEX IF NOT EXISTS appointments_mechanic_date_desc_idx
  ON public.appointments (mechanic_id, date DESC);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.timeslots
    GROUP BY mechanic_id, date, start_time, end_time
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Skipped unique timeslot index: duplicate timeslots exist. Run diagnostics and clean duplicates first.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS timeslots_mechanic_date_time_unique_idx
      ON public.timeslots (mechanic_id, date, start_time, end_time);
  END IF;
END;
$$;

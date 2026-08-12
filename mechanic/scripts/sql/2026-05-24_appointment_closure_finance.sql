BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.role = 'admin'
    ),
    false
  );
$$;

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('confirmado', 'nao_finalizado', 'cancelado', 'acabado'));

DROP INDEX IF EXISTS public.appointments_one_confirmado_per_timeslot;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_active_per_timeslot
  ON public.appointments (timeslot_id)
  WHERE status IN ('confirmado', 'nao_finalizado') AND timeslot_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.appointment_service_reports (
  appointment_id UUID PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  mechanic_id UUID REFERENCES public.mechanics(id) ON DELETE CASCADE NOT NULL,
  summary TEXT NOT NULL CHECK (char_length(trim(summary)) BETWEEN 3 AND 240),
  diagnosis TEXT CHECK (char_length(coalesce(diagnosis, '')) <= 1000),
  work_performed TEXT NOT NULL CHECK (char_length(trim(work_performed)) BETWEEN 3 AND 2000),
  parts_used TEXT CHECK (char_length(coalesce(parts_used, '')) <= 1000),
  recommendations TEXT CHECK (char_length(coalesce(recommendations, '')) <= 1000),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
  closed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.appointment_service_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.appointment_service_reports(appointment_id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 2 AND 160),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.appointment_service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_service_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS appointment_service_reports_mechanic_closed_idx
  ON public.appointment_service_reports (mechanic_id, closed_at DESC);

CREATE INDEX IF NOT EXISTS appointment_service_items_appointment_order_idx
  ON public.appointment_service_items (appointment_id, sort_order);

CREATE INDEX IF NOT EXISTS appointments_date_status_mechanic_idx
  ON public.appointments (date DESC, status, mechanic_id);

REVOKE ALL ON public.appointment_service_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.appointment_service_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_service_reports TO authenticated;
GRANT SELECT ON public.appointment_service_items TO authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Permitted users can view service reports" ON public.appointment_service_reports;
CREATE POLICY "Permitted users can view service reports"
  ON public.appointment_service_reports
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = appointment_id
        AND ((SELECT auth.uid()) = a.client_id OR (SELECT auth.uid()) = a.mechanic_id)
    )
  );

DROP POLICY IF EXISTS "Permitted users can view service items" ON public.appointment_service_items;
CREATE POLICY "Permitted users can view service items"
  ON public.appointment_service_items
  FOR SELECT
  TO authenticated
  USING (
    (SELECT private.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id = appointment_id
        AND ((SELECT auth.uid()) = a.client_id OR (SELECT auth.uid()) = a.mechanic_id)
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view permitted appointments" ON public.appointments;
CREATE POLICY "Authenticated users can view permitted appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = client_id
    OR (SELECT auth.uid()) = mechanic_id
    OR (SELECT private.is_admin())
  );

CREATE OR REPLACE FUNCTION public.sync_unfinalized_appointments()
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
  SET status = 'nao_finalizado'
  WHERE status = 'confirmado'
    AND date < (timezone('America/Sao_Paulo'::text, now()))::date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_acabado_appointments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN public.sync_unfinalized_appointments();
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

  IF v_appointment.status NOT IN ('confirmado', 'nao_finalizado') THEN
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

CREATE OR REPLACE FUNCTION public.complete_mechanic_appointment(
  p_appointment_id UUID,
  p_summary TEXT,
  p_diagnosis TEXT DEFAULT NULL,
  p_work_performed TEXT DEFAULT NULL,
  p_parts_used TEXT DEFAULT NULL,
  p_recommendations TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_appointment RECORD;
  v_item JSONB;
  v_description TEXT;
  v_amount INTEGER;
  v_index INTEGER := 0;
  v_total INTEGER := 0;
  v_closed_at TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'service items must be an array';
  END IF;

  IF char_length(trim(coalesce(p_summary, ''))) < 3 OR char_length(trim(coalesce(p_summary, ''))) > 240 THEN
    RAISE EXCEPTION 'summary must be between 3 and 240 characters';
  END IF;

  IF char_length(trim(coalesce(p_work_performed, ''))) < 3 OR char_length(trim(coalesce(p_work_performed, ''))) > 2000 THEN
    RAISE EXCEPTION 'work performed must be between 3 and 2000 characters';
  END IF;

  IF char_length(coalesce(p_diagnosis, '')) > 1000
    OR char_length(coalesce(p_parts_used, '')) > 1000
    OR char_length(coalesce(p_recommendations, '')) > 1000 THEN
    RAISE EXCEPTION 'service detail too long';
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

  IF v_appointment.status NOT IN ('confirmado', 'nao_finalizado') THEN
    RAISE EXCEPTION 'cannot complete appointment with status %', v_appointment.status;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointment_service_reports r
    WHERE r.appointment_id = v_appointment.id
  ) THEN
    RAISE EXCEPTION 'appointment already has service report';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_index := v_index + 1;
    IF v_index > 30 THEN
      RAISE EXCEPTION 'too many service items';
    END IF;

    v_description := trim(coalesce(v_item->>'description', ''));
    v_amount := NULLIF(v_item->>'amountCents', '')::INTEGER;

    IF char_length(v_description) < 2 OR char_length(v_description) > 160 THEN
      RAISE EXCEPTION 'service item description must be between 2 and 160 characters';
    END IF;

    IF v_amount IS NULL OR v_amount < 0 THEN
      RAISE EXCEPTION 'service item amount must be non-negative';
    END IF;

    v_total := v_total + v_amount;
  END LOOP;

  IF v_index = 0 THEN
    RAISE EXCEPTION 'at least one service item is required';
  END IF;

  INSERT INTO public.appointment_service_reports (
    appointment_id,
    mechanic_id,
    summary,
    diagnosis,
    work_performed,
    parts_used,
    recommendations,
    total_amount_cents,
    closed_at,
    updated_at
  )
  VALUES (
    v_appointment.id,
    v_appointment.mechanic_id,
    trim(p_summary),
    nullif(trim(coalesce(p_diagnosis, '')), ''),
    trim(p_work_performed),
    nullif(trim(coalesce(p_parts_used, '')), ''),
    nullif(trim(coalesce(p_recommendations, '')), ''),
    v_total,
    v_closed_at,
    v_closed_at
  );

  v_index := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.appointment_service_items (appointment_id, description, amount_cents, sort_order)
    VALUES (
      v_appointment.id,
      trim(v_item->>'description'),
      (v_item->>'amountCents')::INTEGER,
      v_index
    );
    v_index := v_index + 1;
  END LOOP;

  UPDATE public.appointments
  SET status = 'acabado'
  WHERE id = v_appointment.id;

  RETURN jsonb_build_object(
    'appointmentId', v_appointment.id,
    'status', 'acabado',
    'totalAmountCents', v_total,
    'closedAt', v_closed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_summary(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_today DATE := (timezone('America/Sao_Paulo'::text, now()))::date;
  v_from DATE := COALESCE(p_from, date_trunc('month', (timezone('America/Sao_Paulo'::text, now()))::timestamp)::date);
  v_to DATE := COALESCE(p_to, (timezone('America/Sao_Paulo'::text, now()))::date);
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid date range';
  END IF;

  RETURN jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'generatedAt', timezone('utc'::text, now()),
    'mechanics', (
      SELECT jsonb_build_object(
        'total', count(*)::int,
        'active', count(*) FILTER (WHERE m.is_active)::int,
        'pending', count(*) FILTER (WHERE NOT m.is_active AND m.credentials = 'PENDENTE')::int,
        'inactive', count(*) FILTER (WHERE NOT m.is_active AND m.credentials <> 'PENDENTE')::int
      )
      FROM public.profiles p
      JOIN public.mechanics m ON m.id = p.id
      WHERE p.role = 'mechanic'
    ),
    'appointments', (
      SELECT jsonb_build_object(
        'total', count(*)::int,
        'confirmed', count(*) FILTER (WHERE status = 'confirmado')::int,
        'unfinished', count(*) FILTER (WHERE status = 'nao_finalizado')::int,
        'finished', count(*) FILTER (WHERE status = 'acabado')::int,
        'canceled', count(*) FILTER (WHERE status = 'cancelado')::int,
        'today', count(*) FILTER (WHERE date = v_today)::int,
        'revenueCents', COALESCE(sum(r.total_amount_cents), 0)::int
      )
      FROM public.appointments a
      LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
      WHERE a.date BETWEEN v_from AND v_to
    ),
    'slots', (
      SELECT jsonb_build_object(
        'upcomingAvailable', count(*) FILTER (WHERE date >= v_today AND is_available)::int,
        'upcomingBlocked', count(*) FILTER (WHERE date >= v_today AND NOT is_available)::int
      )
      FROM public.timeslots
    ),
    'appointmentsByDay', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY day), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'date', day,
          'total', count(a.id)::int,
          'confirmed', count(*) FILTER (WHERE status = 'confirmado')::int,
          'unfinished', count(*) FILTER (WHERE status = 'nao_finalizado')::int,
          'finished', count(*) FILTER (WHERE status = 'acabado')::int,
          'canceled', count(*) FILTER (WHERE status = 'cancelado')::int,
          'revenueCents', COALESCE(sum(r.total_amount_cents), 0)::int
        ) AS row_data,
        day
        FROM (
          SELECT gs::date AS day
          FROM generate_series(v_from, v_to, interval '1 day') AS gs
        ) d
        LEFT JOIN public.appointments a ON a.date = d.day
        LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
        GROUP BY day
      ) daily
    ),
    'topMechanics', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY revenue_cents DESC, appointment_count DESC, mechanic_name ASC), '[]'::jsonb)
      FROM (
        SELECT
          count(a.id)::int AS appointment_count,
          COALESCE(sum(r.total_amount_cents), 0)::int AS revenue_cents,
          p.name AS mechanic_name,
          jsonb_build_object(
            'mechanicId', p.id,
            'mechanicName', p.name,
            'specialty', m.specialty,
            'appointments', count(a.id)::int,
            'revenueCents', COALESCE(sum(r.total_amount_cents), 0)::int
          ) AS row_data
        FROM public.appointments a
        JOIN public.mechanics m ON m.id = a.mechanic_id
        JOIN public.profiles p ON p.id = m.id
        LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
        WHERE a.date BETWEEN v_from AND v_to
        GROUP BY p.id, p.name, m.specialty
        ORDER BY revenue_cents DESC, appointment_count DESC, mechanic_name ASC
        LIMIT 5
      ) ranked
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_appointments(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
  p_mechanic_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 25
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_from DATE := COALESCE(p_from, date_trunc('month', (timezone('America/Sao_Paulo'::text, now()))::timestamp)::date);
  v_to DATE := COALESCE(p_to, (timezone('America/Sao_Paulo'::text, now()))::date);
  v_status TEXT := COALESCE(NULLIF(trim(coalesce(p_status, 'all')), ''), 'all');
  v_search TEXT := NULLIF(trim(coalesce(p_search, '')), '');
  v_page INTEGER := greatest(coalesce(p_page, 1), 1);
  v_page_size INTEGER := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset INTEGER := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 25), 1), 100);
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid date range';
  END IF;

  IF v_status NOT IN ('all', 'confirmado', 'nao_finalizado', 'cancelado', 'acabado') THEN
    RAISE EXCEPTION 'invalid appointment status';
  END IF;

  RETURN (
    WITH filtered AS (
      SELECT
        a.id,
        a.client_id,
        cp.name AS client_name,
        cp.phone AS client_phone,
        a.mechanic_id,
        mp.name AS mechanic_name,
        mp.phone AS mechanic_phone,
        m.specialty,
        a.timeslot_id,
        a.date,
        a.start_time,
        a.end_time,
        a.status,
        a.vehicle_info,
        a.notes,
        a.created_at,
        r.summary AS service_summary,
        r.diagnosis AS service_diagnosis,
        r.work_performed AS work_performed,
        r.parts_used AS parts_used,
        r.recommendations AS recommendations,
        r.total_amount_cents AS total_amount_cents,
        r.closed_at AS closed_at,
        (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', i.id,
            'description', i.description,
            'amountCents', i.amount_cents,
            'sortOrder', i.sort_order
          ) ORDER BY i.sort_order), '[]'::jsonb)
          FROM public.appointment_service_items i
          WHERE i.appointment_id = a.id
        ) AS service_items
      FROM public.appointments a
      JOIN public.profiles cp ON cp.id = a.client_id
      JOIN public.mechanics m ON m.id = a.mechanic_id
      JOIN public.profiles mp ON mp.id = m.id
      LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
      WHERE a.date BETWEEN v_from AND v_to
        AND (v_status = 'all' OR a.status = v_status)
        AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
        AND (
          v_search IS NULL
          OR cp.name ILIKE '%' || v_search || '%'
          OR mp.name ILIKE '%' || v_search || '%'
          OR coalesce(cp.phone, '') ILIKE '%' || v_search || '%'
          OR coalesce(mp.phone, '') ILIKE '%' || v_search || '%'
          OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
          OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
        )
    ),
    total AS (
      SELECT count(*)::int AS value FROM filtered
    ),
    page_rows AS (
      SELECT *
      FROM filtered
      ORDER BY date DESC, start_time DESC, created_at DESC
      LIMIT v_page_size OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (SELECT value FROM total),
      'rows', COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'clientId', client_id,
        'clientName', client_name,
        'clientPhone', client_phone,
        'mechanicId', mechanic_id,
        'mechanicName', mechanic_name,
        'mechanicPhone', mechanic_phone,
        'specialty', specialty,
        'timeSlotId', timeslot_id,
        'date', date,
        'startTime', start_time,
        'endTime', end_time,
        'status', status,
        'vehicleInfo', vehicle_info,
        'notes', notes,
        'serviceSummary', service_summary,
        'serviceDiagnosis', service_diagnosis,
        'workPerformed', work_performed,
        'partsUsed', parts_used,
        'recommendations', recommendations,
        'totalAmountCents', total_amount_cents,
        'closedAt', closed_at,
        'serviceItems', service_items,
        'createdAt', created_at
      ) ORDER BY date DESC, start_time DESC, created_at DESC), '[]'::jsonb)
    )
    FROM page_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_appointment_detail(p_appointment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', a.id,
      'clientId', a.client_id,
      'clientName', cp.name,
      'clientPhone', cp.phone,
      'mechanicId', a.mechanic_id,
      'mechanicName', mp.name,
      'mechanicPhone', mp.phone,
      'specialty', m.specialty,
      'timeSlotId', a.timeslot_id,
      'date', a.date,
      'startTime', a.start_time,
      'endTime', a.end_time,
      'status', a.status,
      'vehicleInfo', a.vehicle_info,
      'notes', a.notes,
      'serviceSummary', r.summary,
      'serviceDiagnosis', r.diagnosis,
      'workPerformed', r.work_performed,
      'partsUsed', r.parts_used,
      'recommendations', r.recommendations,
      'totalAmountCents', r.total_amount_cents,
      'closedAt', r.closed_at,
      'serviceItems', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', i.id,
          'description', i.description,
          'amountCents', i.amount_cents,
          'sortOrder', i.sort_order
        ) ORDER BY i.sort_order), '[]'::jsonb)
        FROM public.appointment_service_items i
        WHERE i.appointment_id = a.id
      ),
      'createdAt', a.created_at
    )
    FROM public.appointments a
    JOIN public.profiles cp ON cp.id = a.client_id
    JOIN public.mechanics m ON m.id = a.mechanic_id
    JOIN public.profiles mp ON mp.id = m.id
    LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
    WHERE a.id = p_appointment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_financial_report(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_mechanic_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_from DATE := COALESCE(p_from, date_trunc('month', (timezone('America/Sao_Paulo'::text, now()))::timestamp)::date);
  v_to DATE := COALESCE(p_to, (timezone('America/Sao_Paulo'::text, now()))::date);
  v_search TEXT := NULLIF(trim(coalesce(p_search, '')), '');
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_to < v_from THEN
    RAISE EXCEPTION 'invalid date range';
  END IF;

  RETURN jsonb_build_object(
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'generatedAt', timezone('utc'::text, now()),
    'summary', (
      SELECT jsonb_build_object(
        'appointments', count(*)::int,
        'revenueCents', COALESCE(sum(r.total_amount_cents), 0)::int,
        'averageTicketCents', CASE WHEN count(*) = 0 THEN 0 ELSE (COALESCE(sum(r.total_amount_cents), 0) / count(*))::int END
      )
      FROM public.appointment_service_reports r
      JOIN public.appointments a ON a.id = r.appointment_id
      JOIN public.profiles cp ON cp.id = a.client_id
      JOIN public.profiles mp ON mp.id = a.mechanic_id
      WHERE a.date BETWEEN v_from AND v_to
        AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
        AND (
          v_search IS NULL
          OR cp.name ILIKE '%' || v_search || '%'
          OR mp.name ILIKE '%' || v_search || '%'
          OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
          OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
        )
    ),
    'byMechanic', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY revenue_cents DESC, mechanic_name ASC), '[]'::jsonb)
      FROM (
        SELECT
          a.mechanic_id,
          mp.name AS mechanic_name,
          m.specialty,
          count(*)::int AS appointments_count,
          COALESCE(sum(r.total_amount_cents), 0)::int AS revenue_cents,
          jsonb_build_object(
            'mechanicId', a.mechanic_id,
            'mechanicName', mp.name,
            'specialty', m.specialty,
            'appointments', count(*)::int,
            'revenueCents', COALESCE(sum(r.total_amount_cents), 0)::int
          ) AS row_data
        FROM public.appointment_service_reports r
        JOIN public.appointments a ON a.id = r.appointment_id
        JOIN public.mechanics m ON m.id = a.mechanic_id
        JOIN public.profiles mp ON mp.id = a.mechanic_id
        JOIN public.profiles cp ON cp.id = a.client_id
        WHERE a.date BETWEEN v_from AND v_to
          AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
          AND (
            v_search IS NULL
            OR cp.name ILIKE '%' || v_search || '%'
            OR mp.name ILIKE '%' || v_search || '%'
            OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
            OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
          )
        GROUP BY a.mechanic_id, mp.name, m.specialty
      ) rows
    ),
    'byService', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY revenue_cents DESC, description ASC), '[]'::jsonb)
      FROM (
        SELECT
          i.description,
          count(*)::int AS quantity,
          COALESCE(sum(i.amount_cents), 0)::int AS revenue_cents,
          jsonb_build_object(
            'description', i.description,
            'quantity', count(*)::int,
            'revenueCents', COALESCE(sum(i.amount_cents), 0)::int
          ) AS row_data
        FROM public.appointment_service_items i
        JOIN public.appointment_service_reports r ON r.appointment_id = i.appointment_id
        JOIN public.appointments a ON a.id = r.appointment_id
        JOIN public.profiles cp ON cp.id = a.client_id
        JOIN public.profiles mp ON mp.id = a.mechanic_id
        WHERE a.date BETWEEN v_from AND v_to
          AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
          AND (
            v_search IS NULL
            OR cp.name ILIKE '%' || v_search || '%'
            OR mp.name ILIKE '%' || v_search || '%'
            OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
            OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
            OR i.description ILIKE '%' || v_search || '%'
          )
        GROUP BY i.description
      ) rows
    ),
    'appointments', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY date DESC, closed_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          a.date,
          r.closed_at,
          jsonb_build_object(
            'id', a.id,
            'date', a.date,
            'clientName', cp.name,
            'mechanicName', mp.name,
            'vehicleInfo', a.vehicle_info,
            'serviceSummary', r.summary,
            'totalAmountCents', r.total_amount_cents,
            'closedAt', r.closed_at
          ) AS row_data
        FROM public.appointment_service_reports r
        JOIN public.appointments a ON a.id = r.appointment_id
        JOIN public.profiles cp ON cp.id = a.client_id
        JOIN public.profiles mp ON mp.id = a.mechanic_id
        WHERE a.date BETWEEN v_from AND v_to
          AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
          AND (
            v_search IS NULL
            OR cp.name ILIKE '%' || v_search || '%'
            OR mp.name ILIKE '%' || v_search || '%'
            OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
            OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
          )
      ) rows
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_unfinalized_appointments() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_acabado_appointments() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_mechanic_appointment(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_mechanic_appointment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_dashboard_summary(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_appointments(DATE, DATE, TEXT, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_appointment_detail(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_financial_report(DATE, DATE, UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.sync_unfinalized_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_acabado_appointments() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mechanic_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mechanic_appointment(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_appointments(DATE, DATE, TEXT, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_appointment_detail(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_financial_report(DATE, DATE, UUID, TEXT) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

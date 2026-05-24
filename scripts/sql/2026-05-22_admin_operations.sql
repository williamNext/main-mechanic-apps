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

CREATE TABLE IF NOT EXISTS public.admin_action_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_mechanic_id UUID REFERENCES public.mechanics(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('approve_mechanic', 'reject_mechanic')),
  note TEXT CHECK (char_length(coalesce(note, '')) <= 500),
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS admin_action_log_target_created_idx
  ON public.admin_action_log (target_mechanic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS admin_action_log_actor_created_idx
  ON public.admin_action_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mechanics_active_credentials_idx
  ON public.mechanics (is_active, credentials);

CREATE INDEX IF NOT EXISTS appointments_date_status_mechanic_idx
  ON public.appointments (date DESC, status, mechanic_id);

DROP POLICY IF EXISTS "Admins can view action log" ON public.admin_action_log;
CREATE POLICY "Admins can view action log"
  ON public.admin_action_log
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins can insert action log" ON public.admin_action_log;
CREATE POLICY "Admins can insert action log"
  ON public.admin_action_log
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT private.is_admin()) AND actor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can view all mechanic details" ON public.mechanics;
CREATE POLICY "Admins can view all mechanic details"
  ON public.mechanics
  FOR SELECT
  TO authenticated
  USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins can update mechanic approval" ON public.mechanics;
CREATE POLICY "Admins can update mechanic approval"
  ON public.mechanics
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.is_admin()))
  WITH CHECK ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Mechanics can insert own timeslots" ON public.timeslots;
CREATE POLICY "Mechanics can insert own timeslots"
  ON public.timeslots
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = mechanic_id);

DROP POLICY IF EXISTS "Mechanics can update own timeslots" ON public.timeslots;
CREATE POLICY "Mechanics can update own timeslots"
  ON public.timeslots
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = mechanic_id)
  WITH CHECK ((SELECT auth.uid()) = mechanic_id);

DROP POLICY IF EXISTS "Mechanics can delete own timeslots" ON public.timeslots;
CREATE POLICY "Mechanics can delete own timeslots"
  ON public.timeslots
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = mechanic_id);

DROP POLICY IF EXISTS "Admins can view all appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Mechanics can view assigned appointments" ON public.appointments;
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

REVOKE ALL ON public.admin_action_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.admin_action_log TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

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
        'finished', count(*) FILTER (WHERE status = 'acabado')::int,
        'canceled', count(*) FILTER (WHERE status = 'cancelado')::int,
        'today', count(*) FILTER (WHERE date = v_today)::int
      )
      FROM public.appointments
      WHERE date BETWEEN v_from AND v_to
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
          'finished', count(*) FILTER (WHERE status = 'acabado')::int,
          'canceled', count(*) FILTER (WHERE status = 'cancelado')::int
        ) AS row_data,
        day
        FROM (
          SELECT gs::date AS day
          FROM generate_series(v_from, v_to, interval '1 day') AS gs
        ) d
        LEFT JOIN public.appointments a ON a.date = d.day
        GROUP BY day
      ) daily
    ),
    'topMechanics', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY appointment_count DESC, mechanic_name ASC), '[]'::jsonb)
      FROM (
        SELECT
          count(a.id)::int AS appointment_count,
          p.name AS mechanic_name,
          jsonb_build_object(
            'mechanicId', p.id,
            'mechanicName', p.name,
            'specialty', m.specialty,
            'appointments', count(a.id)::int
          ) AS row_data
        FROM public.appointments a
        JOIN public.mechanics m ON m.id = a.mechanic_id
        JOIN public.profiles p ON p.id = m.id
        WHERE a.date BETWEEN v_from AND v_to
        GROUP BY p.id, p.name, m.specialty
        ORDER BY appointment_count DESC, mechanic_name ASC
        LIMIT 5
      ) ranked
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_mechanics(
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'all',
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
  v_search TEXT := NULLIF(trim(coalesce(p_search, '')), '');
  v_status TEXT := COALESCE(NULLIF(trim(coalesce(p_status, 'all')), ''), 'all');
  v_page INTEGER := greatest(coalesce(p_page, 1), 1);
  v_page_size INTEGER := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset INTEGER := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 25), 1), 100);
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_status NOT IN ('all', 'pending', 'active', 'inactive') THEN
    RAISE EXCEPTION 'invalid mechanic status';
  END IF;

  RETURN (
    WITH filtered AS (
      SELECT
        p.id,
        p.name,
        p.email,
        p.phone,
        p.avatar_url,
        p.created_at,
        m.specialty,
        m.credentials,
        m.is_active,
        count(a.id)::int AS appointments_total,
        count(a.id) FILTER (WHERE a.status = 'confirmado')::int AS appointments_confirmed,
        max(a.date) AS last_appointment_date
      FROM public.profiles p
      JOIN public.mechanics m ON m.id = p.id
      LEFT JOIN public.appointments a ON a.mechanic_id = m.id
      WHERE p.role = 'mechanic'
        AND (
          v_status = 'all'
          OR (v_status = 'pending' AND NOT m.is_active AND m.credentials = 'PENDENTE')
          OR (v_status = 'active' AND m.is_active)
          OR (v_status = 'inactive' AND NOT m.is_active AND m.credentials <> 'PENDENTE')
        )
        AND (
          v_search IS NULL
          OR p.name ILIKE '%' || v_search || '%'
          OR coalesce(p.email, '') ILIKE '%' || v_search || '%'
          OR coalesce(p.phone, '') ILIKE '%' || v_search || '%'
          OR m.specialty ILIKE '%' || v_search || '%'
        )
      GROUP BY p.id, p.name, p.email, p.phone, p.avatar_url, p.created_at, m.specialty, m.credentials, m.is_active
    ),
    total AS (
      SELECT count(*)::int AS value FROM filtered
    ),
    page_rows AS (
      SELECT *
      FROM filtered
      ORDER BY
        CASE WHEN is_active = false AND credentials = 'PENDENTE' THEN 0 ELSE 1 END,
        created_at DESC,
        name ASC
      LIMIT v_page_size OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'total', (SELECT value FROM total),
      'rows', COALESCE(jsonb_agg(jsonb_build_object(
        'id', id,
        'name', name,
        'email', email,
        'phone', phone,
        'avatarUrl', avatar_url,
        'createdAt', created_at,
        'specialty', specialty,
        'credentials', credentials,
        'isActive', is_active,
        'appointmentsTotal', appointments_total,
        'appointmentsConfirmed', appointments_confirmed,
        'lastAppointmentDate', last_appointment_date
      ) ORDER BY
        CASE WHEN is_active = false AND credentials = 'PENDENTE' THEN 0 ELSE 1 END,
        created_at DESC,
        name ASC
      ), '[]'::jsonb)
    )
    FROM page_rows
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

  IF v_status NOT IN ('all', 'confirmado', 'cancelado', 'acabado') THEN
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
        a.created_at
      FROM public.appointments a
      JOIN public.profiles cp ON cp.id = a.client_id
      JOIN public.mechanics m ON m.id = a.mechanic_id
      JOIN public.profiles mp ON mp.id = m.id
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
        'createdAt', created_at
      ) ORDER BY date DESC, start_time DESC, created_at DESC), '[]'::jsonb)
    )
    FROM page_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_mechanic_detail(
  p_mechanic_id UUID,
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
  v_from DATE := COALESCE(p_from, date_trunc('month', (timezone('America/Sao_Paulo'::text, now()))::timestamp)::date);
  v_to DATE := COALESCE(p_to, (timezone('America/Sao_Paulo'::text, now()))::date);
  v_result JSONB;
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_mechanic_id IS NULL THEN
    RAISE EXCEPTION 'mechanic id required';
  END IF;

  SELECT jsonb_build_object(
    'mechanic', jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'email', p.email,
      'phone', p.phone,
      'avatarUrl', p.avatar_url,
      'createdAt', p.created_at,
      'specialty', m.specialty,
      'credentials', m.credentials,
      'isActive', m.is_active
    ),
    'range', jsonb_build_object('from', v_from, 'to', v_to),
    'appointmentStats', (
      SELECT jsonb_build_object(
        'total', count(*)::int,
        'confirmed', count(*) FILTER (WHERE status = 'confirmado')::int,
        'finished', count(*) FILTER (WHERE status = 'acabado')::int,
        'canceled', count(*) FILTER (WHERE status = 'cancelado')::int
      )
      FROM public.appointments a
      WHERE a.mechanic_id = p_mechanic_id
        AND a.date BETWEEN v_from AND v_to
    ),
    'slotStats', (
      SELECT jsonb_build_object(
        'totalUpcoming', count(*) FILTER (WHERE date >= (timezone('America/Sao_Paulo'::text, now()))::date)::int,
        'availableUpcoming', count(*) FILTER (WHERE date >= (timezone('America/Sao_Paulo'::text, now()))::date AND is_available)::int
      )
      FROM public.timeslots t
      WHERE t.mechanic_id = p_mechanic_id
    ),
    'recentAppointments', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY date DESC, start_time DESC), '[]'::jsonb)
      FROM (
        SELECT
          a.date,
          a.start_time,
          jsonb_build_object(
            'id', a.id,
            'clientId', a.client_id,
            'clientName', cp.name,
            'clientPhone', cp.phone,
            'date', a.date,
            'startTime', a.start_time,
            'endTime', a.end_time,
            'status', a.status,
            'vehicleInfo', a.vehicle_info,
            'notes', a.notes,
            'createdAt', a.created_at
          ) AS row_data
        FROM public.appointments a
        JOIN public.profiles cp ON cp.id = a.client_id
        WHERE a.mechanic_id = p_mechanic_id
        ORDER BY a.date DESC, a.start_time DESC
        LIMIT 20
      ) recent
    ),
    'approvalHistory', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          l.created_at,
          jsonb_build_object(
            'id', l.id,
            'action', l.action,
            'note', l.note,
            'actorId', l.actor_id,
            'actorName', actor.name,
            'createdAt', l.created_at,
            'beforeState', l.before_state,
            'afterState', l.after_state
          ) AS row_data
        FROM public.admin_action_log l
        LEFT JOIN public.profiles actor ON actor.id = l.actor_id
        WHERE l.target_mechanic_id = p_mechanic_id
        ORDER BY l.created_at DESC
        LIMIT 20
      ) history
    )
  )
  INTO v_result
  FROM public.profiles p
  JOIN public.mechanics m ON m.id = p.id
  WHERE p.id = p_mechanic_id
    AND p.role = 'mechanic';

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'mechanic not found';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_mechanic_approval(
  p_mechanic_id UUID,
  p_approved BOOLEAN,
  p_credentials TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_credentials TEXT := NULLIF(trim(coalesce(p_credentials, '')), '');
  v_note TEXT := NULLIF(trim(coalesce(p_note, '')), '');
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_mechanic_id IS NULL OR p_approved IS NULL THEN
    RAISE EXCEPTION 'mechanic id and approval are required';
  END IF;

  IF v_credentials IS NOT NULL AND char_length(v_credentials) > 180 THEN
    RAISE EXCEPTION 'credentials too long';
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'note too long';
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'specialty', m.specialty,
    'credentials', m.credentials,
    'isActive', m.is_active
  )
  INTO v_before
  FROM public.profiles p
  JOIN public.mechanics m ON m.id = p.id
  WHERE p.id = p_mechanic_id
    AND p.role = 'mechanic'
  FOR UPDATE OF m;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'mechanic not found';
  END IF;

  UPDATE public.mechanics
  SET
    is_active = p_approved,
    credentials = CASE
      WHEN p_approved THEN COALESCE(v_credentials, 'APROVADO')
      ELSE COALESCE(v_credentials, 'REJEITADO')
    END
  WHERE id = p_mechanic_id;

  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'email', p.email,
    'phone', p.phone,
    'avatarUrl', p.avatar_url,
    'createdAt', p.created_at,
    'specialty', m.specialty,
    'credentials', m.credentials,
    'isActive', m.is_active
  )
  INTO v_after
  FROM public.profiles p
  JOIN public.mechanics m ON m.id = p.id
  WHERE p.id = p_mechanic_id;

  INSERT INTO public.admin_action_log (
    actor_id,
    target_mechanic_id,
    action,
    note,
    before_state,
    after_state
  )
  VALUES (
    v_actor,
    p_mechanic_id,
    CASE WHEN p_approved THEN 'approve_mechanic' ELSE 'reject_mechanic' END,
    v_note,
    v_before,
    v_after
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_summary(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_mechanics(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_appointments(DATE, DATE, TEXT, UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_mechanic_detail(UUID, DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_mechanic_approval(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_mechanics(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_appointments(DATE, DATE, TEXT, UUID, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_mechanic_detail(UUID, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_mechanic_approval(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

COMMIT;

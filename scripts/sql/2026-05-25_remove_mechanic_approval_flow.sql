BEGIN;

ALTER TABLE public.mechanics
  ALTER COLUMN is_active SET DEFAULT true;

DROP INDEX IF EXISTS public.mechanics_active_credentials_idx;

DROP POLICY IF EXISTS "Users can insert pending own mechanic details" ON public.mechanics;

DROP POLICY IF EXISTS "Users can insert own non-admin profile" ON public.profiles;
CREATE POLICY "Users can insert own client profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND role = 'client');

DROP TRIGGER IF EXISTS enforce_mechanic_approval_guard ON public.mechanics;
DROP FUNCTION IF EXISTS private.enforce_mechanic_approval_guard();

CREATE OR REPLACE FUNCTION private.enforce_mechanic_admin_fields_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'mechanic active status must be true';
    END IF;
    RETURN NEW;
  END IF;

  IF (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.uid()) = NEW.id
    AND (
      NEW.is_active IS DISTINCT FROM OLD.is_active
      OR NEW.credentials IS DISTINCT FROM OLD.credentials
    )
  THEN
    RAISE EXCEPTION 'mechanic admin fields are admin-controlled';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_mechanic_admin_fields_guard
  BEFORE INSERT OR UPDATE ON public.mechanics
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_mechanic_admin_fields_guard();

DROP FUNCTION IF EXISTS public.admin_create_mechanic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_delete_mechanics(UUID[]);
DROP FUNCTION IF EXISTS public.admin_set_mechanic_approval(UUID, BOOLEAN, TEXT, TEXT);

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
        'active', count(*)::int
      )
      FROM public.profiles p
      JOIN public.mechanics m ON m.id = p.id
      WHERE p.role = 'mechanic'
        AND m.is_active = true
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
          AND m.is_active = true
        GROUP BY p.id, p.name, m.specialty
        LIMIT 8
      ) ranked
    )
  );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_mechanics(TEXT, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION public.admin_list_mechanics(
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
  v_search TEXT := NULLIF(trim(coalesce(p_search, '')), '');
  v_page INTEGER := greatest(coalesce(p_page, 1), 1);
  v_page_size INTEGER := least(greatest(coalesce(p_page_size, 25), 1), 100);
  v_offset INTEGER := (greatest(coalesce(p_page, 1), 1) - 1) * least(greatest(coalesce(p_page_size, 25), 1), 100);
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
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
        AND m.is_active = true
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
      ORDER BY created_at DESC, name ASC
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
      ) ORDER BY created_at DESC, name ASC), '[]'::jsonb)
    )
    FROM page_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_summary(DATE, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_mechanics(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_mechanics(TEXT, INTEGER, INTEGER) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

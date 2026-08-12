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
    'revenueByDay', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY day), '[]'::jsonb)
      FROM (
        SELECT
          d.day,
          jsonb_build_object(
            'date', d.day,
            'appointments', count(r.appointment_id) FILTER (
              WHERE v_search IS NULL
                OR cp.name ILIKE '%' || v_search || '%'
                OR mp.name ILIKE '%' || v_search || '%'
                OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
                OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
            )::int,
            'revenueCents', COALESCE(sum(r.total_amount_cents) FILTER (
              WHERE v_search IS NULL
                OR cp.name ILIKE '%' || v_search || '%'
                OR mp.name ILIKE '%' || v_search || '%'
                OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
                OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
            ), 0)::int
          ) AS row_data
        FROM (
          SELECT gs::date AS day
          FROM generate_series(v_from, v_to, interval '1 day') AS gs
        ) d
        LEFT JOIN public.appointments a ON a.date = d.day
          AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
        LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
        LEFT JOIN public.profiles cp ON cp.id = a.client_id
        LEFT JOIN public.profiles mp ON mp.id = a.mechanic_id
        GROUP BY d.day
      ) rows
    ),
    'revenueByMonth', (
      SELECT COALESCE(jsonb_agg(row_data ORDER BY month_start), '[]'::jsonb)
      FROM (
        SELECT
          m.month_start,
          jsonb_build_object(
            'month', to_char(m.month_start, 'YYYY-MM'),
            'appointments', count(r.appointment_id) FILTER (
              WHERE v_search IS NULL
                OR cp.name ILIKE '%' || v_search || '%'
                OR mp.name ILIKE '%' || v_search || '%'
                OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
                OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
            )::int,
            'revenueCents', COALESCE(sum(r.total_amount_cents) FILTER (
              WHERE v_search IS NULL
                OR cp.name ILIKE '%' || v_search || '%'
                OR mp.name ILIKE '%' || v_search || '%'
                OR coalesce(a.vehicle_info, '') ILIKE '%' || v_search || '%'
                OR coalesce(r.summary, '') ILIKE '%' || v_search || '%'
            ), 0)::int
          ) AS row_data
        FROM (
          SELECT gs::date AS month_start
          FROM generate_series(date_trunc('month', v_from)::date, date_trunc('month', v_to)::date, interval '1 month') AS gs
        ) m
        LEFT JOIN public.appointments a ON a.date >= m.month_start
          AND a.date < (m.month_start + interval '1 month')
          AND a.date BETWEEN v_from AND v_to
          AND (p_mechanic_id IS NULL OR a.mechanic_id = p_mechanic_id)
        LEFT JOIN public.appointment_service_reports r ON r.appointment_id = a.id
        LEFT JOIN public.profiles cp ON cp.id = a.client_id
        LEFT JOIN public.profiles mp ON mp.id = a.mechanic_id
        GROUP BY m.month_start
      ) rows
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

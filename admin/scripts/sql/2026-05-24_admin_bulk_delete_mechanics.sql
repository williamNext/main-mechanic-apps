BEGIN;

ALTER TABLE public.admin_action_log
  DROP CONSTRAINT IF EXISTS admin_action_log_action_check;

ALTER TABLE public.admin_action_log
  ADD CONSTRAINT admin_action_log_action_check
  CHECK (action IN ('approve_mechanic', 'reject_mechanic', 'delete_mechanic'));

DROP POLICY IF EXISTS "Admins can delete mechanic details" ON public.mechanics;
CREATE POLICY "Admins can delete mechanic details"
  ON public.mechanics
  FOR DELETE
  TO authenticated
  USING ((SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins can delete mechanic profiles" ON public.profiles;
CREATE POLICY "Admins can delete mechanic profiles"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING ((SELECT private.is_admin()) AND role = 'mechanic');

CREATE OR REPLACE FUNCTION public.admin_delete_mechanics(
  p_mechanic_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_ids UUID[];
  v_found_count INTEGER := 0;
  v_deleted_count INTEGER := 0;
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT array_agg(DISTINCT mechanic_id)
  INTO v_ids
  FROM unnest(coalesce(p_mechanic_ids, ARRAY[]::UUID[])) AS mechanic_id
  WHERE mechanic_id IS NOT NULL;

  IF coalesce(array_length(v_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'mechanic ids required';
  END IF;

  IF array_length(v_ids, 1) > 100 THEN
    RAISE EXCEPTION 'too many mechanics selected';
  END IF;

  WITH targets AS (
    SELECT
      p.id,
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'email', p.email,
        'phone', p.phone,
        'specialty', m.specialty,
        'credentials', m.credentials,
        'isActive', m.is_active
      ) AS before_state
    FROM public.profiles p
    JOIN public.mechanics m ON m.id = p.id
    WHERE p.id = ANY(v_ids)
      AND p.role = 'mechanic'
    -- FOR UPDATE OF p, m removed because locking requires UPDATE policies under RLS
  ), logged AS (
    INSERT INTO public.admin_action_log (
      actor_id,
      target_mechanic_id,
      action,
      note,
      before_state,
      after_state
    )
    SELECT
      v_actor,
      id,
      'delete_mechanic',
      'Bulk delete from admin directory',
      before_state,
      '{}'::jsonb
    FROM targets
    RETURNING target_mechanic_id
  ), deleted AS (
    DELETE FROM public.profiles p
    USING logged l
    WHERE p.id = l.target_mechanic_id
      AND p.role = 'mechanic'
    RETURNING p.id
  )
  SELECT
    (SELECT count(*)::int FROM logged),
    (SELECT count(*)::int FROM deleted)
  INTO v_found_count, v_deleted_count;

  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'no matching mechanics found';
  END IF;

  RETURN jsonb_build_object(
    'deletedCount', v_deleted_count,
    'requestedCount', array_length(v_ids, 1),
    'ignoredCount', array_length(v_ids, 1) - v_found_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_mechanics(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_mechanics(UUID[]) TO authenticated;
GRANT DELETE ON public.profiles TO authenticated;
GRANT DELETE ON public.mechanics TO authenticated;

COMMIT;

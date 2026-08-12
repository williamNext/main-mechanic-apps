-- Allow authenticated clients to browse active mechanics.
-- Existing own-profile/appointment/admin access remains through private.can_view_profile().
-- Inactive mechanic details remain restricted to owner/admin access.

DROP POLICY IF EXISTS "Authenticated users can browse active mechanic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can browse active mechanics" ON public.mechanics;

DROP POLICY IF EXISTS "Users can view permitted profiles" ON public.profiles;
CREATE POLICY "Users can view permitted profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    private.can_view_profile(id)
    OR (
      role = 'mechanic'
      AND EXISTS (
        SELECT 1
        FROM public.mechanics m
        WHERE m.id = profiles.id
          AND m.is_active = TRUE
      )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can view permitted mechanic details" ON public.mechanics;
CREATE POLICY "Authenticated users can view permitted mechanic details"
  ON public.mechanics
  FOR SELECT
  TO authenticated
  USING (
    is_active = TRUE
    OR (SELECT auth.uid()) = id
    OR (SELECT private.is_admin())
  );

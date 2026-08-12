BEGIN;

DROP POLICY IF EXISTS "Admins can view all mechanic details" ON public.mechanics;
DROP POLICY IF EXISTS "Users can view own mechanic details" ON public.mechanics;
DROP POLICY IF EXISTS "Authenticated users can view permitted mechanic details" ON public.mechanics;
CREATE POLICY "Authenticated users can view permitted mechanic details"
  ON public.mechanics
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.is_admin()));

DROP POLICY IF EXISTS "Admins can update mechanic approval" ON public.mechanics;
DROP POLICY IF EXISTS "Users can update own mechanic profile basics" ON public.mechanics;
DROP POLICY IF EXISTS "Authenticated users can update permitted mechanic details" ON public.mechanics;
CREATE POLICY "Authenticated users can update permitted mechanic details"
  ON public.mechanics
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT private.is_admin()))
  WITH CHECK ((SELECT auth.uid()) = id OR (SELECT private.is_admin()));

COMMIT;

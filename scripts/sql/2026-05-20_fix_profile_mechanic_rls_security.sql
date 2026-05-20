BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.mechanics
  ALTER COLUMN is_active SET DEFAULT false,
  ALTER COLUMN credentials SET DEFAULT 'PENDENTE';

CREATE TABLE IF NOT EXISTS public.public_mechanics (
  id UUID PRIMARY KEY REFERENCES public.mechanics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.public_mechanics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public mechanics are viewable by everyone" ON public.public_mechanics;
CREATE POLICY "Public mechanics are viewable by everyone"
  ON public.public_mechanics
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE OR REPLACE FUNCTION private.can_view_profile(p_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_profile_id IS NOT NULL
    AND (SELECT auth.uid()) IS NOT NULL
    AND (
      (SELECT auth.uid()) = p_profile_id
      OR EXISTS (
        SELECT 1
        FROM public.appointments a
        WHERE (a.client_id = (SELECT auth.uid()) AND a.mechanic_id = p_profile_id)
           OR (a.mechanic_id = (SELECT auth.uid()) AND a.client_id = p_profile_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = (SELECT auth.uid())
          AND p.role = 'admin'
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.enforce_profile_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> NEW.id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.role = 'admin' THEN
    RAISE EXCEPTION 'users cannot self-assign admin role';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'users cannot change their own role';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_role_guard ON public.profiles;
CREATE TRIGGER enforce_profile_role_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_profile_role_guard();

CREATE OR REPLACE FUNCTION private.enforce_mechanic_approval_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) <> NEW.id THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active IS DISTINCT FROM false OR NEW.credentials IS DISTINCT FROM 'PENDENTE' THEN
      RAISE EXCEPTION 'mechanic approval fields are admin-controlled';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_active IS DISTINCT FROM OLD.is_active OR NEW.credentials IS DISTINCT FROM OLD.credentials THEN
      RAISE EXCEPTION 'mechanic approval fields are admin-controlled';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_mechanic_approval_guard ON public.mechanics;
CREATE TRIGGER enforce_mechanic_approval_guard
  BEFORE INSERT OR UPDATE ON public.mechanics
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_mechanic_approval_guard();

CREATE OR REPLACE FUNCTION private.refresh_public_mechanic(p_mechanic_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.public_mechanics
  WHERE id = p_mechanic_id;

  INSERT INTO public.public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, timezone('utc'::text, now())
  FROM public.profiles p
  JOIN public.mechanics m ON m.id = p.id
  WHERE m.id = p_mechanic_id
    AND p.role = 'mechanic'
    AND m.is_active = true;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_public_mechanic_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_public_mechanic(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM private.refresh_public_mechanic(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.refresh_public_mechanic_from_mechanics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM private.refresh_public_mechanic(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM private.refresh_public_mechanic(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_public_mechanic_from_profile ON public.profiles;
CREATE TRIGGER refresh_public_mechanic_from_profile
  AFTER INSERT OR UPDATE OF name, role, avatar_url OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.refresh_public_mechanic_from_profile();

DROP TRIGGER IF EXISTS refresh_public_mechanic_from_mechanics ON public.mechanics;
CREATE TRIGGER refresh_public_mechanic_from_mechanics
  AFTER INSERT OR UPDATE OF specialty, is_active OR DELETE ON public.mechanics
  FOR EACH ROW
  EXECUTE FUNCTION private.refresh_public_mechanic_from_mechanics();

SELECT private.refresh_public_mechanic(id)
FROM public.mechanics;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view permitted profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (private.can_view_profile(id));

CREATE POLICY "Users can insert own non-admin profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND role IN ('client', 'mechanic'));

CREATE POLICY "Users can update own profile basics"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Mechanics are viewable by everyone" ON public.mechanics;
DROP POLICY IF EXISTS "Mechanics can insert own details" ON public.mechanics;
DROP POLICY IF EXISTS "Mechanics can update own details" ON public.mechanics;

CREATE POLICY "Users can view own mechanic details"
  ON public.mechanics
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert pending own mechanic details"
  ON public.mechanics
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id AND credentials = 'PENDENTE' AND is_active = false);

CREATE POLICY "Users can update own mechanic profile basics"
  ON public.mechanics
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mechanics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.public_mechanics FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mechanics TO authenticated;
GRANT SELECT ON public.public_mechanics TO anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.book_client_appointment(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_client_appointment(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_mechanic_appointment(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_acabado_appointments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_client_appointment(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_client_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_mechanic_appointment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_acabado_appointments() TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

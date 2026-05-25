BEGIN;

CREATE OR REPLACE FUNCTION public.admin_create_mechanic(
  p_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_email TEXT,
  p_specialty TEXT,
  p_credentials TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (SELECT private.is_admin()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.profiles (id, name, phone, email, role)
  VALUES (p_id, p_name, p_phone, p_email, 'mechanic')
  ON CONFLICT (id) DO UPDATE
  SET name = p_name, phone = p_phone, email = p_email, role = 'mechanic';

  INSERT INTO public.mechanics (id, specialty, credentials, is_active)
  VALUES (p_id, p_specialty, p_credentials, false)
  ON CONFLICT (id) DO UPDATE
  SET specialty = p_specialty, credentials = p_credentials;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_mechanic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_mechanic(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMIT;

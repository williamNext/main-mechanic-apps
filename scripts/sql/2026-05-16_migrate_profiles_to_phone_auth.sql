-- Phone-auth migration for existing rebuilt DB.
-- Clients authenticated by phone do not need fake email identities.

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

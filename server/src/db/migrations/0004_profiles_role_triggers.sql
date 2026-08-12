CREATE TRIGGER IF NOT EXISTS trg_profiles_role_bi
BEFORE INSERT ON profiles
FOR EACH ROW
WHEN NEW.role NOT IN ('admin','mechanic','client')
BEGIN
  SELECT RAISE(ABORT, 'invalid role');
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_profiles_role_bu
BEFORE UPDATE OF role ON profiles
FOR EACH ROW
WHEN NEW.role NOT IN ('admin','mechanic','client')
BEGIN
  SELECT RAISE(ABORT, 'invalid role');
END;

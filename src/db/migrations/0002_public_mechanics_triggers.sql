-- Custom SQL migration file, put your code below! --

-- Ports private.refresh_public_mechanic(id) and its two calling triggers from
-- mechanic/scripts/sql/2026-05-16_rebuild_public_app_schema_from_scratch.sql:200-262. SQLite has
-- no stored functions, so the routine body (DELETE the stale row, then INSERT a fresh one from a
-- profiles/mechanics join filtered to role='mechanic' AND is_active=1) is inlined into every
-- trigger below. SQLite also requires one CREATE TRIGGER per event type where Postgres allowed a
-- single "AFTER INSERT OR UPDATE OF ... OR DELETE" definition, so two source triggers become six
-- here (01-RESEARCH.md Pattern 3, "Important divergence from the Postgres source").
--
-- The delete-then-filtered-insert shape is what makes withdrawal (deactivation, role change) work
-- for free: if the affected row no longer qualifies, the INSERT's WHERE clause matches nothing
-- and the DELETE has already removed the stale entry. This must never be replaced with an upsert.

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_profiles_ai
AFTER INSERT ON profiles
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = NEW.id;
  INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM profiles p
  JOIN mechanics m ON m.id = p.id
  WHERE p.id = NEW.id
    AND p.role = 'mechanic'
    AND m.is_active = 1;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_profiles_au
AFTER UPDATE OF name, role, avatar_url ON profiles
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = NEW.id;
  INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM profiles p
  JOIN mechanics m ON m.id = p.id
  WHERE p.id = NEW.id
    AND p.role = 'mechanic'
    AND m.is_active = 1;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_profiles_ad
AFTER DELETE ON profiles
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = OLD.id;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_mechanics_ai
AFTER INSERT ON mechanics
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = NEW.id;
  INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM profiles p
  JOIN mechanics m ON m.id = p.id
  WHERE m.id = NEW.id
    AND p.role = 'mechanic'
    AND m.is_active = 1;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_mechanics_au
AFTER UPDATE OF specialty, is_active ON mechanics
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = NEW.id;
  INSERT INTO public_mechanics (id, name, specialty, avatar_url, updated_at)
  SELECT p.id, p.name, m.specialty, p.avatar_url, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM profiles p
  JOIN mechanics m ON m.id = p.id
  WHERE m.id = NEW.id
    AND p.role = 'mechanic'
    AND m.is_active = 1;
END;--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS trg_public_mechanics_mechanics_ad
AFTER DELETE ON mechanics
FOR EACH ROW
BEGIN
  DELETE FROM public_mechanics WHERE id = OLD.id;
END;

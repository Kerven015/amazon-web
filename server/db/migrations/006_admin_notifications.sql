-- Admin notifications ("what's new since I last looked") and clearing the activity log.

/* --------------------------------------------------------------------------
   When the admin last opened each section (orders, reviews, customers, inventory).
   Anything newer than seen_at is counted as new in the "Manage" menu.
-------------------------------------------------------------------------- */
CREATE TABLE admin_seen (
  username text NOT NULL,
  section  text NOT NULL CHECK (section IN ('orders', 'reviews', 'customers', 'inventory')),
  seen_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (username, section)
);

/* --------------------------------------------------------------------------
   Clearing the activity log. The app role still can't UPDATE or DELETE log rows
   directly (005); this function is the only way, and it always leaves one entry
   saying who cleared the log, when, and how many entries were removed.
   It runs with the owner's rights (SECURITY DEFINER) and a fixed search_path.
-------------------------------------------------------------------------- */
CREATE FUNCTION clear_admin_audit_log(p_actor text, p_ip text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM admin_audit_log;
  GET DIAGNOSTICS removed = ROW_COUNT;
  INSERT INTO admin_audit_log (actor, action, entity_type, entity_id, details, ip)
  VALUES (p_actor, 'activity.clear', 'admin', p_actor, jsonb_build_object('removed', removed), p_ip);
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION clear_admin_audit_log(text, text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vendora_app') THEN
    GRANT EXECUTE ON FUNCTION clear_admin_audit_log(text, text) TO vendora_app;
  END IF;
END $$;

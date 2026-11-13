-- FR-AUDIT-03: row triggers do not fire on TRUNCATE, so the owner could still empty the table.
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_reject_change();

-- Tables from later migrations reach the application role without each migration granting them.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cms_app;

-- The application has no business reading or changing migration history.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    REVOKE ALL ON _prisma_migrations FROM cms_app;
  END IF;
END;
$$;

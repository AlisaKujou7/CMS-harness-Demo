#!/bin/sh
# Gives the application role a login, which the migrations leave without one (ADR-0013). Runs from
# scripts/migrate.sh, piped into the container, since a mount's path would differ per release and so
# recreate the database on each deploy. Changing the password in .env and deploying applies it.
# Migrations keep running as the owner.
set -eu

psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set app_password="$CMS_APP_DB_PASSWORD" <<'SQL'
SELECT 'CREATE ROLE cms_app' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cms_app')
\gexec
ALTER ROLE cms_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'app_password';
SQL

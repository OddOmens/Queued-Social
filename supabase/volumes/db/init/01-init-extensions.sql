-- Runs once when the PostgreSQL container first starts.
-- Enables all extensions required by the app.

CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgjwt";

-- Allow pg_cron to call edge functions from any database user
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Allow pg_net HTTP calls
GRANT USAGE ON SCHEMA net TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA net TO postgres;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA net TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA net TO postgres;

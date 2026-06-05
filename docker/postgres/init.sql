-- Extensions enabled on first start
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the umami database if it doesn't exist
-- (Umami needs its own DB in the same Postgres instance for local dev)
SELECT 'CREATE DATABASE umami OWNER poraykemon'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec

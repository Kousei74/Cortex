-- 01_users_and_auth.sql
DROP TABLE IF EXISTS users CASCADE;
DROP SEQUENCE IF EXISTS emp_id_seq CASCADE;

CREATE SEQUENCE IF NOT EXISTS emp_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_emp_id()
RETURNS TEXT AS $$
DECLARE
    next_val INT;
BEGIN
    SELECT nextval('emp_id_seq') INTO next_val;
    RETURN 'E' || lpad(next_val::text, 3, '0');
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    emp_id TEXT DEFAULT generate_emp_id() PRIMARY KEY,
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    dept_id TEXT REFERENCES departments(dept_id),
    role TEXT DEFAULT 'team_member' CHECK (role IN ('senior', 'team_member')),
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users DISABLE ROW LEVEL SECURITY;


-- Seed Users Logic handled in 06_seed_data.sql


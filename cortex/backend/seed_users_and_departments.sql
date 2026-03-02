-- 1. Create STATIC department table
CREATE TABLE IF NOT EXISTS departments (
    dept_id TEXT PRIMARY KEY,
    dept_name TEXT UNIQUE NOT NULL
);

-- Force Disable RLS so the backend (using 'anon' key) can query for login
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;

-- Insert static data
INSERT INTO departments (dept_id, dept_name) VALUES
('D01', 'Dev1'),
('D02', 'Dev2'),
('D03', 'Dev3'),
('D04', 'CS1'),
('D05', 'CS2'),
('D06', 'Analyst'),
('D07', 'Risk')
ON CONFLICT (dept_id) DO NOTHING;

-- 2. Create `users` table with Auto-Generated EmpID
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

-- Drop existing users table to apply the clean syntax (WARNING: This destroys existing auth data!)
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    emp_id TEXT DEFAULT generate_emp_id() PRIMARY KEY,
    id UUID DEFAULT gen_random_uuid() UNIQUE,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name TEXT,
    dept_id TEXT,
    role TEXT DEFAULT 'team_member',
    is_approved BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_users_departments FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- Force Disable RLS so the backend (using 'anon' key) can query for login
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 3. Populate Users (3 per department)
-- Password for all mock users is "password123"
DO $$
DECLARE
    dept RECORD;
    i INT;
    user_email TEXT;
    user_name TEXT;
    user_role TEXT;
BEGIN
    FOR dept IN SELECT dept_id, dept_name FROM departments LOOP
        FOR i IN 1..3 LOOP
            user_email := 'trial' || lower(dept.dept_name) || i || '@gmail.com';
            user_name := 'Test ' || dept.dept_name || ' User ' || i;
            IF i = 1 THEN
                user_role := 'senior';
            ELSE
                user_role := 'team_member';
            END IF;
            
            INSERT INTO users (email, hashed_password, full_name, dept_id, role, is_approved)
            VALUES (
                user_email,
                '$2b$12$GoteGAMf4H1UINhzyy6Vnun5FaSnGXVcEkGgXvsrKBDQWVCm0/sni',
                user_name,
                dept.dept_id,
                user_role,
                TRUE
            ) ON CONFLICT (email) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 06_seed_data.sql
-- Seeding Departments
INSERT INTO departments (dept_id, dept_name) VALUES
('D01', 'Dev1'), ('D02', 'Dev2'), ('D03', 'Dev3'),
('D04', 'CS1'), ('D05', 'CS2'),
('D06', 'Analyst'), ('D07', 'Risk')
ON CONFLICT (dept_id) DO NOTHING;

-- Seed Users Logic
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
            user_role := CASE WHEN i = 1 THEN 'senior' ELSE 'team_member' END;
            
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

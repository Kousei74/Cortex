-- 1. Upgrade the users table (if not already containing these fields)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS emp_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS dept_id TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'team_member'; 
-- role can be 'senior' or 'team_member'

-- 2. Create the Issues table
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('new', 'existing', 'merged_truth')),
    parent_id TEXT REFERENCES issues(issue_id) ON DELETE CASCADE,
    header TEXT NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    priority TEXT,
    assigned_team TEXT,
    dept_id TEXT,
    emp_id TEXT NOT NULL,
    created_by TEXT NOT NULL,
    tag TEXT DEFAULT 'pending' CHECK (tag IN ('pending', 'yellow', 'blue', 'green', 'red')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    parent_ticket TEXT,
    chained_to TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies
-- Policy: A user can view issues assigned to their DeptID or issues they created themselves.
-- Note: Assuming your backend validates the JWT and passes the auth context, or enforces it at the API layer.
DROP POLICY IF EXISTS "View team or own issues" ON issues;
CREATE POLICY "View team or own issues" ON issues
FOR SELECT
USING (
   emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
   OR 
   dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
   OR
   assigned_team = current_setting('request.jwt.claims', true)::json->>'dept_id'
);

-- Policy: Only Seniors or creators (within 30 mins) can Delete
DROP POLICY IF EXISTS "Delete own within 30m or Senior" ON issues;
CREATE POLICY "Delete own within 30m or Senior" ON issues
FOR DELETE
USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'senior'
    OR
    (emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id' AND (NOW() - created_at) < INTERVAL '30 minutes')
);

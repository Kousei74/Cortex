-- 1. Upgrade the users table (if not already containing these fields)
-- This was from your previous schema and still necessary if missing.
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS emp_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS dept_id TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'team_member'; 

-- =====================================================================
-- WARNING: This will drop the existing 'issues' table and its data.
-- Only run this if you are okay with wiping the old issues records!
-- =====================================================================
DROP TABLE IF EXISTS issue_assignments_history;
DROP TABLE IF EXISTS issue_node_metadata;
DROP TABLE IF EXISTS issue_nodes;
DROP TABLE IF EXISTS issues;

-- 2. Create Enums for strict type checking
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_priority') THEN
        CREATE TYPE issue_priority AS ENUM ('critical', 'high', 'mid', 'low');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
        CREATE TYPE issue_status AS ENUM ('open', 'closed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_node_type') THEN
        CREATE TYPE issue_node_type AS ENUM ('update', 'merged_truth');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_tag') THEN
        CREATE TYPE issue_tag AS ENUM ('green', 'blue', 'yellow', 'red', 'pending');
    END IF;
END $$;


-- 3. Core Tables
-- Root Issues Table
CREATE TABLE issues (
    id TEXT PRIMARY KEY, -- e.g., 'ISS-XXXXXXXX'
    header TEXT NOT NULL,
    description TEXT NOT NULL,
    priority issue_priority NOT NULL,
    status issue_status DEFAULT 'open' NOT NULL,
    created_by_emp_id TEXT NOT NULL,
    assigned_dept_id TEXT,
    dept_id TEXT, -- Added to track origin department of the issue creator
    parent_external_ticket TEXT,
    chained_issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issue Nodes (Updates & Sub-issues) Table
CREATE TABLE issue_nodes (
    id TEXT PRIMARY KEY, -- e.g., 'NODE-XXXX' or 'MERGE-XXXX'
    root_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    parent_node_id TEXT REFERENCES issue_nodes(id) ON DELETE CASCADE,
    header TEXT NOT NULL,
    description TEXT NOT NULL,
    node_type issue_node_type NOT NULL,
    tag issue_tag NOT NULL DEFAULT 'pending',
    created_by_emp_id TEXT NOT NULL,
    dept_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issue Node Metadata (For Merged Blue Branch tracking)
CREATE TABLE issue_node_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_node_id TEXT NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
    original_node_id TEXT NOT NULL,
    historical_header TEXT,
    historical_description TEXT,
    historical_created_by TEXT,
    historical_created_at TIMESTAMPTZ
);

-- Issue Assignments History (For analytics)
CREATE TABLE issue_assignments_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    assigned_dept_id TEXT NOT NULL,
    assigned_by_emp_id TEXT NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable Row Level Security
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_nodes ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for 'issues'
-- Policy: View team or own issues
CREATE POLICY "View team or own issues" ON issues
FOR SELECT
USING (
   created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
   OR 
   dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
   OR
   assigned_dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
);

-- Policy: Delete own within 30m or Senior
CREATE POLICY "Delete own within 30m or Senior" ON issues
FOR DELETE
USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'senior'
    OR
    (created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id' AND (NOW() - created_at) < INTERVAL '30 minutes')
);

-- Policy: Allow inserting own issues
CREATE POLICY "Insert own issues" ON issues
FOR INSERT
WITH CHECK (
    created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
);

-- Policy: Allow updating own issues or team issues
CREATE POLICY "Update own or team issues" ON issues
FOR UPDATE
USING (
   created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
   OR 
   dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
   OR
   assigned_dept_id = current_setting('request.jwt.claims', true)::json->>'dept_id'
);

-- 6. RLS Policies for 'issue_nodes'
-- Policy: View nodes if you can view the root issue (sub-query verification)
CREATE POLICY "View nodes of accessible issues" ON issue_nodes
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM issues 
        WHERE issues.id = issue_nodes.root_issue_id
    )
);

-- Policy: Delete node rules matching the root rules
CREATE POLICY "Delete own node within 30m or Senior" ON issue_nodes
FOR DELETE
USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'senior'
    OR
    (created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id' AND (NOW() - created_at) < INTERVAL '30 minutes')
);

-- Policy: Insert node if you can view the root issue
CREATE POLICY "Insert accessible nodes" ON issue_nodes
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM issues 
        WHERE issues.id = issue_nodes.root_issue_id
    )
);

-- Policy: Update node if you created it or senior
CREATE POLICY "Update own nodes or Senior" ON issue_nodes
FOR UPDATE
USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'senior'
    OR
    created_by_emp_id = current_setting('request.jwt.claims', true)::json->>'emp_id'
);

-- 7. Indexes for performance
CREATE INDEX idx_issues_status ON issues(status);
CREATE INDEX idx_issues_last_activity ON issues(last_activity_at);
CREATE INDEX idx_issue_nodes_root_id ON issue_nodes(root_issue_id);
CREATE INDEX idx_issue_nodes_parent_id ON issue_nodes(parent_node_id);

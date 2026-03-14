-- 03_core_tables.sql
DROP TABLE IF EXISTS issue_assignments_history CASCADE;
DROP TABLE IF EXISTS issue_node_metadata CASCADE;
DROP TABLE IF EXISTS issue_nodes CASCADE;
DROP TABLE IF EXISTS issues CASCADE;

CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY, -- Internal UUID-like string
    issue_id TEXT UNIQUE NOT NULL, -- Legacy human-readable ID (e.g. ISS-XXXX)
    type TEXT NOT NULL CHECK (type IN ('new', 'existing', 'merged_truth')),
    header TEXT NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    priority issue_priority NOT NULL,
    status issue_status DEFAULT 'open' NOT NULL,
    created_by TEXT, -- Display name for legacy parity
    created_by_emp_id TEXT NOT NULL REFERENCES users(emp_id),
    emp_id TEXT, -- Legacy alias for created_by_emp_id
    dept_id TEXT REFERENCES departments(dept_id),
    assigned_dept_ids TEXT[] DEFAULT '{}',
    parent_id TEXT, -- Legacy alias for chained_issue_id or parent relationship
    parent_ticket TEXT, -- Legacy alias for parent_external_ticket
    parent_external_ticket TEXT,
    chained_issue_id TEXT REFERENCES issues(id) ON DELETE SET NULL,
    code_changes TEXT,
    code_language TEXT,
    deadline DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_nodes (
    id TEXT PRIMARY KEY,
    root_issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    parent_node_id TEXT REFERENCES issue_nodes(id) ON DELETE CASCADE,
    connected_to_id TEXT REFERENCES issue_nodes(id) ON DELETE CASCADE,
    header TEXT NOT NULL,
    description TEXT NOT NULL,
    node_type issue_node_type NOT NULL,
    tag issue_tag NOT NULL DEFAULT 'pending',
    created_by TEXT, -- Display name for legacy parity
    created_by_emp_id TEXT NOT NULL REFERENCES users(emp_id),
    dept_id TEXT REFERENCES departments(dept_id),
    code_changes TEXT,
    code_language TEXT,
    layout_x NUMERIC,
    layout_y NUMERIC,
    senior_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_node_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_node_id TEXT NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
    original_node_id TEXT NOT NULL REFERENCES issue_nodes(id) ON DELETE CASCADE,
    historical_header TEXT,
    historical_description TEXT,
    historical_created_by TEXT,
    historical_created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS issue_assignments_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id TEXT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    assigned_dept_id TEXT NOT NULL REFERENCES departments(dept_id),
    assigned_by_emp_id TEXT NOT NULL REFERENCES users(emp_id),
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);




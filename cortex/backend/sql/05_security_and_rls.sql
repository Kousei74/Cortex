-- 05_security_and_rls.sql
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_node_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_assignments_history ENABLE ROW LEVEL SECURITY;

-- Issues
DROP POLICY IF EXISTS "View team or own issues" ON issues;
CREATE POLICY "View team or own issues" ON issues
FOR SELECT
USING (
    (current_setting('request.jwt.claims', true)::json->>'user_role') = 'senior'
    OR created_by_emp_id = (current_setting('request.jwt.claims', true)::json->>'emp_id')
    OR dept_id = (current_setting('request.jwt.claims', true)::json->>'dept_id')
    OR (current_setting('request.jwt.claims', true)::json->>'dept_id') = ANY(assigned_dept_ids)
);

DROP POLICY IF EXISTS "Insert own issues" ON issues;
CREATE POLICY "Insert own issues" ON issues
FOR INSERT
WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->>'user_role') = 'senior'
    OR created_by_emp_id = (current_setting('request.jwt.claims', true)::json->>'emp_id')
);

DROP POLICY IF EXISTS "Update own or team issues" ON issues;
CREATE POLICY "Update own or team issues" ON issues
FOR UPDATE
USING (
    (current_setting('request.jwt.claims', true)::json->>'user_role') = 'senior'
    OR created_by_emp_id = (current_setting('request.jwt.claims', true)::json->>'emp_id')
    OR dept_id = (current_setting('request.jwt.claims', true)::json->>'dept_id')
    OR (current_setting('request.jwt.claims', true)::json->>'dept_id') = ANY(assigned_dept_ids)
);

DROP POLICY IF EXISTS "Delete own within 30m or Senior" ON issues;
CREATE POLICY "Delete own within 30m or Senior" ON issues
FOR DELETE
USING (
    (current_setting('request.jwt.claims', true)::json->>'user_role') = 'senior'
    OR (
        created_by_emp_id = (current_setting('request.jwt.claims', true)::json->>'emp_id') 
        AND (NOW() - created_at) < INTERVAL '30 minutes'
    )
);

-- Nodes
DROP POLICY IF EXISTS "View nodes of accessible issues" ON issue_nodes;
CREATE POLICY "View nodes of accessible issues" ON issue_nodes
FOR SELECT
USING (
    EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_nodes.root_issue_id)
);

DROP POLICY IF EXISTS "Insert accessible nodes" ON issue_nodes;
CREATE POLICY "Insert accessible nodes" ON issue_nodes
FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_nodes.root_issue_id)
);

DROP POLICY IF EXISTS "Update own nodes or Senior" ON issue_nodes;
CREATE POLICY "Update own nodes or Senior" ON issue_nodes
FOR UPDATE
USING (
    (current_setting('request.jwt.claims', true)::json->>'user_role') = 'senior'
    OR created_by_emp_id = (current_setting('request.jwt.claims', true)::json->>'emp_id')
);

DROP POLICY IF EXISTS "Delete own node within 30m or Senior" ON issue_nodes;
CREATE POLICY "Delete own node within 30m or Senior" ON issue_nodes
FOR DELETE
USING (
    (current_setting('request.jwt.claims', true)::json->>'user_role') = 'senior'
    OR (
        created_by_emp_id = (current_setting('request.jwt.claims', true)::json->>'emp_id') 
        AND (NOW() - created_at) < INTERVAL '30 minutes'
    )
);

-- Metadata & History
DROP POLICY IF EXISTS "View metadata of accessible nodes" ON issue_node_metadata;
CREATE POLICY "View metadata of accessible nodes" ON issue_node_metadata
FOR SELECT USING (
    EXISTS (SELECT 1 FROM issue_nodes WHERE issue_nodes.id = issue_node_metadata.merge_node_id)
);

DROP POLICY IF EXISTS "View accessible assignment history" ON issue_assignments_history;
CREATE POLICY "View accessible assignment history" ON issue_assignments_history
FOR SELECT USING (
    EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_assignments_history.issue_id)
);


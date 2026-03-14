-- 07_indexes.sql
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_last_activity ON issues(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_root_id ON issue_nodes(root_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_parent_id ON issue_nodes(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_issue_nodes_connected_to ON issue_nodes(connected_to_id);
CREATE INDEX IF NOT EXISTS idx_users_dept ON users(dept_id);

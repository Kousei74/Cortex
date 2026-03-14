-- 04_constraints_and_triggers.sql
-- The Axe Rule: If the truth foundation is deleted (cascade from parent_node_id or manual delete),
-- lateral connections (connected_to_id) must also vanish if they depend on it.
ALTER TABLE issue_nodes 
DROP CONSTRAINT IF EXISTS fk_issue_nodes_connected_to;

ALTER TABLE issue_nodes
ADD CONSTRAINT fk_issue_nodes_connected_to
FOREIGN KEY (connected_to_id) 
REFERENCES issue_nodes(id) 
ON DELETE CASCADE;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_issue_nodes_modtime ON issue_nodes;
CREATE TRIGGER update_issue_nodes_modtime 
BEFORE UPDATE ON issue_nodes 
FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

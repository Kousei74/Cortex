-- 08_migration_connection_type.sql
-- Solidifying Issue Tracker Graph Structure

-- 1. Add connection_type and layout_locked columns to issue_nodes table
ALTER TABLE issue_nodes
ADD COLUMN IF NOT EXISTS connection_type TEXT CHECK (connection_type IN ('MAIN', 'LEFT', 'RIGHT')),
ADD COLUMN IF NOT EXISTS layout_locked BOOLEAN DEFAULT TRUE;

-- 2. Backfill connection_type using robust relative positioning inference
-- This guarantees existing geometry layouts are retained logically.
WITH computed_branch AS (
    SELECT 
        child.id AS node_id,
        CASE
            WHEN abs(COALESCE(child.layout_x, 0) - COALESCE(parent.layout_x, 0)) > abs(COALESCE(child.layout_y, 0) - COALESCE(parent.layout_y, 0)) THEN
                CASE 
                    WHEN (COALESCE(child.layout_x, 0) - COALESCE(parent.layout_x, 0)) > 0 THEN 'RIGHT'
                    ELSE 'LEFT' 
                END
            ELSE 'MAIN'
        END AS inferred_type
    FROM issue_nodes child
    LEFT JOIN issue_nodes parent ON child.parent_node_id = parent.id
    WHERE child.parent_node_id IS NOT NULL
)
UPDATE issue_nodes
SET connection_type = cb.inferred_type
FROM computed_branch cb
WHERE issue_nodes.id = cb.node_id
  AND issue_nodes.connection_type IS NULL;

-- 3. Set all root-level entries or un-joined orphans definitively to MAIN path
UPDATE issue_nodes
SET connection_type = 'MAIN'
WHERE connection_type IS NULL;

-- 4. Secure the table constraints for future-proofing insertion policies
ALTER TABLE issue_nodes ALTER COLUMN connection_type SET NOT NULL;
ALTER TABLE issue_nodes ALTER COLUMN connection_type SET DEFAULT 'MAIN';

-- 5. Freeze existing visual locations allowing dagre fallback independence 
UPDATE issue_nodes
SET layout_locked = TRUE;

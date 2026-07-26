-- 02_domain_types.sql
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

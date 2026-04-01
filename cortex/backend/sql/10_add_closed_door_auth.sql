-- Migration 10: Closed-Door Auth Tables (Access Requests & Invite Tokens)

-- access_requests table
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(255) REFERENCES users(emp_id) ON DELETE SET NULL
);

ALTER TABLE access_requests
    DROP CONSTRAINT IF EXISTS access_requests_status_check;
ALTER TABLE access_requests
    ADD CONSTRAINT access_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired'));

CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_status_created_at ON access_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_access_requests_status_reviewed_at ON access_requests(status, reviewed_at);

-- invite_tokens table
CREATE TABLE IF NOT EXISTS invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES access_requests(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    approved_dept_id VARCHAR(50) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'invite_tokens'
          AND column_name = 'dept_id'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'invite_tokens'
          AND column_name = 'approved_dept_id'
    ) THEN
        ALTER TABLE invite_tokens RENAME COLUMN dept_id TO approved_dept_id;
    END IF;
END $$;

ALTER TABLE invite_tokens DROP COLUMN IF EXISTS role;

WITH ranked_invites AS (
    SELECT
        id,
        request_id,
        ROW_NUMBER() OVER (
            PARTITION BY request_id
            ORDER BY created_at DESC, id DESC
        ) AS row_num
    FROM invite_tokens
    WHERE request_id IS NOT NULL
)
DELETE FROM invite_tokens
WHERE id IN (
    SELECT id
    FROM ranked_invites
    WHERE row_num > 1
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_hash ON invite_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens(email);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invite_tokens_request_id ON invite_tokens(request_id);

-- Normalize legacy rows before the new lifecycle takes over
DELETE FROM access_requests WHERE status = 'completed';

-- Enable RLS to satisfy Supabase security warnings
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Note: No permissive policies are added intentionally. 
-- The backend FastAPI service interacts with these tables using the service_role key, 
-- which bypasses RLS. Public anonymous access is completely blocked at the DB level.

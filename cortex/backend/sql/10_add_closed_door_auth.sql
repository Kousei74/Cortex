-- Migration 10: Closed-Door Auth Tables (Access Requests & Invite Tokens)

-- access_requests table
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, completed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by VARCHAR(255) REFERENCES users(emp_id) ON DELETE SET NULL
);

-- index for quick lookups on email and status
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

-- invite_tokens table
CREATE TABLE IF NOT EXISTS invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES access_requests(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    dept_id VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'team_member',
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- index for token lookups
CREATE INDEX IF NOT EXISTS idx_invite_tokens_hash ON invite_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_email ON invite_tokens(email);

-- Enable RLS to satisfy Supabase security warnings
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Note: No permissive policies are added intentionally. 
-- The backend FastAPI service interacts with these tables using the service_role key, 
-- which bypasses RLS. Public anonymous access is completely blocked at the DB level.

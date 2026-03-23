ALTER TABLE users
    ADD COLUMN IF NOT EXISTS slack_access_token TEXT,
    ADD COLUMN IF NOT EXISTS slack_connected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS slack_user_id TEXT,
    ADD COLUMN IF NOT EXISTS slack_team_id TEXT,
    ADD COLUMN IF NOT EXISTS slack_team_name TEXT;

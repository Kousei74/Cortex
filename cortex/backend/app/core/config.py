
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cortex Engine"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "dev-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    # Note: This MUST match the JWT Secret found in Supabase Dashboard -> Project Settings -> API
    SUPABASE_JWT_SECRET: str = ""
    # Required for auth endpoints to query the users table when RLS is enabled
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    # Slack OAuth
    SLACK_CLIENT_ID: str = ""
    SLACK_CLIENT_SECRET: str = ""
    SLACK_REDIRECT_URI: str = "http://localhost:8000/service/slack/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = ""
    INVITE_SIGNUP_URL: str = "http://localhost:5173/signup"

    # Invite / Request Access Operations
    INVITE_TOKEN_EXPIRE_MINUTES: int = 60
    AUTH_PENDING_RETENTION_DAYS: int = 30
    AUTH_REJECTED_RETENTION_DAYS: int = 30
    AUTH_EXPIRED_RETENTION_DAYS: int = 7
    AUTH_APPROVAL_PAGE_SIZE: int = 50
    AUTH_ADMIN_EMP_ID: str = ""

    # Resend
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = ""
    RESEND_FROM_NAME: str = "Cortex"

    # Visualization Constants (The Constitution)
    MAX_CLUSTERS: int = 50
    MIN_ROWS_TIME: int = 30
    METRIC_DENSITY_THRESHOLD: float = 0.05
    TIME_DOMAIN_IQR_THRESHOLD: float = 10.0
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_ACTIVE_JOBS_PER_USER: int = 1
    MAX_PENDING_JOBS: int = 15
    WORKER_JOB_TIMEOUT_SECONDS: int = 120
    WORKER_REAPER_INTERVAL_SECONDS: int = 5

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )

settings = Settings()

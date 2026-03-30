
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

    # Visualization Constants (The Constitution)
    MAX_CLUSTERS: int = 50
    MIN_ROWS_TIME: int = 30
    METRIC_DENSITY_THRESHOLD: float = 0.05
    TIME_DOMAIN_IQR_THRESHOLD: float = 10.0
    MAX_UPLOAD_SIZE_MB: int = 10
    MAX_ACTIVE_JOBS_PER_USER: int = 1
    MAX_PENDING_JOBS: int = 15

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )

settings = Settings()

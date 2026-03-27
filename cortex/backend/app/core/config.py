
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cortex Engine"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    # Note: This MUST match the JWT Secret found in Supabase Dashboard -> Project Settings -> API
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET")
    # Required for auth endpoints to query the users table when RLS is enabled
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    
    # Slack OAuth
    SLACK_CLIENT_ID:     str = os.getenv("SLACK_CLIENT_ID", "")
    SLACK_CLIENT_SECRET: str = os.getenv("SLACK_CLIENT_SECRET", "")
    SLACK_REDIRECT_URI:  str = os.getenv("SLACK_REDIRECT_URI")
    FRONTEND_URL:        str = os.getenv("FRONTEND_URL")

    # Visualization Constants (The Constitution)
    MAX_CLUSTERS: int = 50
    MIN_ROWS_TIME: int = 30
    METRIC_DENSITY_THRESHOLD: float = 0.05
    TIME_DOMAIN_IQR_THRESHOLD: float = 10.0

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

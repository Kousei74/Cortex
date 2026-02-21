
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Cortex Engine"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-super-secret-key-change-this")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # Visualization Constants (The Constitution)
    MAX_CLUSTERS: int = 50
    MIN_ROWS_TIME: int = 30
    METRIC_DENSITY_THRESHOLD: float = 0.05
    TIME_DOMAIN_IQR_THRESHOLD: float = 10.0

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

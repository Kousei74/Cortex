
from supabase import create_client, Client
from app.core.config import settings

url: str = settings.SUPABASE_URL
key: str = settings.SUPABASE_KEY

if not url or not key:
    print("WARNING: Supabase credentials not found in environment variables.")

supabase: Client = create_client(url, key)

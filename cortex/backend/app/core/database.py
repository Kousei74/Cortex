from supabase import create_client, Client, ClientOptions
from app.core.config import settings
from fastapi import Request

url: str = settings.SUPABASE_URL
key: str = settings.SUPABASE_KEY
service_key: str = settings.SUPABASE_SERVICE_ROLE_KEY

if not url or not key:
    print("WARNING: Supabase credentials not found in environment variables.")

# Global client for operations without a specific user context (like fetching public data)
# Disable auto refresh and persist session for background global clients to prevent thread leaks over 24h
global_options = ClientOptions(auto_refresh_token=False, persist_session=False)

supabase: Client = create_client(url, key, options=global_options)
service_role_supabase: Client = create_client(url, service_key, options=global_options) if service_key else supabase

def get_supabase(request: Request) -> Client:
    """Dependency to get a request-scoped Supabase client with the user's JWT."""
    auth_header = request.headers.get("Authorization")
    
    # Create the client, overriding default headers if an auth token exists.
    # Note: For our custom JWT to be recognized by Supabase's PostgREST,
    # it must follow the correct claim format expected by Supabase.
    headers = {}
    if auth_header:
        headers["Authorization"] = auth_header
        
    return create_client(
        url, 
        key, 
        options=ClientOptions(
            headers=headers,
            auto_refresh_token=False,
            persist_session=False
        )
    )

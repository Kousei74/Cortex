from supabase import create_client, Client, ClientOptions
from app.core.config import settings
from app.core.observability import get_logger, instrument_module_functions, log_step
from fastapi import Request

logger = get_logger(__name__)

url: str = settings.SUPABASE_URL
key: str = settings.SUPABASE_KEY
service_key: str = settings.SUPABASE_SERVICE_ROLE_KEY

if not url or not key:
    logger.warning("Supabase credentials not found in environment variables.")

# Global client for operations without a specific user context (like fetching public data)
# Disable auto refresh and persist session for background global clients to prevent thread leaks over 24h
global_options = ClientOptions(auto_refresh_token=False, persist_session=False)

supabase: Client = create_client(url, key, options=global_options)

if service_key:
    service_role_supabase: Client = create_client(url, service_key, options=global_options)
    # Explicitly force both headers on the PostgREST session.
    # supabase-py 2.11.x (pinned for Render) does not always propagate the service
    # role key into the Authorization: Bearer header, so PostgREST evaluates RLS
    # instead of bypassing it. Being explicit here makes the bypass version-agnostic.
    service_role_supabase.postgrest.session.headers.update({
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    })
else:
    service_role_supabase: Client = supabase

def get_supabase(request: Request) -> Client:
    """Dependency to get a request-scoped Supabase client with the user's JWT."""
    auth_header = request.headers.get("Authorization")
    log_step(logger, "database.get_supabase.begin", has_auth_header=bool(auth_header))
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


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions"})

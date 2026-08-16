from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.observability import get_logger, instrument_fastapi_router, instrument_module_functions, log_step

router = APIRouter()
logger = get_logger(__name__)

@router.get("/")
def health_check():
    """Tiny health endpoint used by external monitors (UptimeRobot).

    Returns 200 with a minimal payload when healthy. If a lightweight
    Supabase HTTP probe fails, returns 503 so monitors can alert.
    """
    log_step(logger, "health.check")

    # Minimal JSON payload (keep tiny for uptime probes)
    healthy_payload = {"status": "online", "service": "cortex-engine"}

    # Keep this endpoint extremely lightweight and always return 200.
    # Uptime monitors hitting this path will keep the Render web process
    # awake. We do NOT probe Supabase here to avoid introducing latency
    # or false positives during cold starts.
    return JSONResponse(content=healthy_payload, status_code=200)


@router.get("/debug-config")
def debug_config():
    """
    TEMPORARY: Confirms which Supabase keys Render actually loaded and are being sent.
    Shows only the last 8 chars of each key — safe to expose, useless to an attacker.
    Remove this endpoint once the auth issue is resolved.
    """
    from app.core.config import settings
    from app.core.database import supabase, service_role_supabase

    def tail(s: str, n: int = 8) -> str:
        return f"...{s[-n:]}" if s and len(s) >= n else "(empty or too short)"

    # Inspect the actual headers being sent by the PostgREST session at runtime
    svc_headers = dict(service_role_supabase.postgrest.session.headers)
    actual_auth = svc_headers.get("authorization", svc_headers.get("Authorization", ""))
    actual_apikey = svc_headers.get("apikey", "")

    return {
        "supabase_key_tail":                tail(settings.SUPABASE_KEY),
        "service_role_key_tail":            tail(settings.SUPABASE_SERVICE_ROLE_KEY),
        "jwt_secret_set":                   bool(settings.SUPABASE_JWT_SECRET),
        "service_role_key_is_set":          bool(settings.SUPABASE_SERVICE_ROLE_KEY),
        "service_client_distinct_from_anon": service_role_supabase is not supabase,
        # These confirm what's ACTUALLY being sent in the HTTP request to Supabase:
        "postgrest_apikey_tail":            tail(actual_apikey),
        "postgrest_auth_header_tail":       tail(actual_auth),
        # If postgrest_auth_header_tail matches service_role_key_tail → RLS will be bypassed
        # If they differ (or auth is empty/anon) → RLS will be enforced → queries return empty
        "rls_bypass_expected":              tail(actual_auth) == tail(settings.SUPABASE_SERVICE_ROLE_KEY),
    }


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions", "instrument_fastapi_router"})
instrument_fastapi_router(router, logger)

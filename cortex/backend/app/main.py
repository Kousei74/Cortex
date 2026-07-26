import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.health import router as health_router
from app.api.endpoints.ingestion import router as ingestion_router
from app.api.endpoints.reports import router as reports_router
from app.api.endpoints.resolution import router as resolution_router
from app.api.endpoints.service_hub import router as service_hub_router
from app.core.config import settings
from app.core.observability import configure_logging, get_logger, log_step, instrument_module_functions

configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)

app = FastAPI(
    title="Cortex Engine",
    description="The Shadow Engine Backend for CORTEX",
    version="0.1.0",
)

# CORS Configuration

def _build_allowed_origins() -> list[str]:
    origins = {
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    }

    for raw_value in [settings.FRONTEND_URL, settings.ALLOWED_ORIGINS]:
        if not raw_value:
            continue
        for origin in str(raw_value).split(","):
            normalized = origin.strip().rstrip("/")
            if normalized:
                origins.add(normalized)

    return sorted(origins)

origins = _build_allowed_origins()
log_step(logger, "cors.origins_loaded", count=len(origins), origins=",".join(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(ingestion_router, prefix="/ingest", tags=["ingestion"])
app.include_router(reports_router, prefix="/reports", tags=["reports"])
app.include_router(resolution_router, prefix="/resolution", tags=["resolution"])
app.include_router(service_hub_router, prefix="/service", tags=["service"])


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    started = time.perf_counter()
    log_step(logger, "request.start", request_id=request_id, method=request.method, path=request.url.path)
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - started) * 1000
        logger.exception(
            "REQUEST ERROR | request_id=%s | method=%s | path=%s | duration_ms=%.2f",
            request_id,
            request.method,
            request.url.path,
            duration_ms,
        )
        raise

    duration_ms = (time.perf_counter() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "REQUEST END | request_id=%s | method=%s | path=%s | status_code=%s | duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response

@app.get("/")
def root():
    log_step(logger, "root.health_ping")
    return {"message": "Cortex Engine Online"}

@app.on_event("startup")
async def startup_event():
    import asyncio
    from app.worker import worker_loop, reaper_loop

    log_step(logger, "startup.begin")
    await asyncio.sleep(1) # Let uvicorn finish initialization and health check response first
    asyncio.create_task(worker_loop())
    asyncio.create_task(reaper_loop())
    log_step(logger, "startup.background_tasks_started")

instrument_module_functions(globals(), logger, exclude_names={"request_logging_middleware"})

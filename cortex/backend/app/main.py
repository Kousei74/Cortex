from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import health, auth, ingestion, reports, resolution, service_hub

app = FastAPI(
    title="Cortex Engine",
    description="The Shadow Engine Backend for CORTEX",
    version="0.1.0",
)

# CORS Configuration
from app.core.config import settings

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
            normalized = origin.strip()
            if normalized:
                origins.add(normalized)

    return sorted(origins)

origins = _build_allowed_origins()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(ingestion.router, prefix="/ingest", tags=["ingestion"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(resolution.router, prefix="/resolution", tags=["resolution"])
app.include_router(service_hub.router, prefix="/service", tags=["service"])

@app.get("/")
def root():
    return {"message": "Cortex Engine Online"}

# Startup Event: Run Worker
import asyncio
from app.worker import worker_loop, reaper_loop

@app.on_event("startup")
async def startup_event():
    print("Initializing Background Worker...")
    asyncio.create_task(worker_loop())
    asyncio.create_task(reaper_loop())

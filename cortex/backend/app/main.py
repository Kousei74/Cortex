from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints import health, auth, ingestion

app = FastAPI(
    title="Cortex Engine",
    description="The Shadow Engine Backend for CORTEX",
    version="0.1.0",
)

# CORS Configuration
origins = [
    "http://localhost:5173",  # Vite Dev Server
    "http://localhost:5174",  # Vite Dev Server Alternate
    "http://localhost:5175",  # Vite Dev Server Alternate 2
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(ingestion.router, prefix="/ingest", tags=["ingestion"])

@app.get("/")
def root():
    return {"message": "Cortex Engine Online"}

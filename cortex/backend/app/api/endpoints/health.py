from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def health_check():
    """
    Simple health check to verify backend connectivity.
    """
    return {"status": "ok", "service": "cortex-engine"}

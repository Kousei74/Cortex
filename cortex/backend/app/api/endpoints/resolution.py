from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.resolution import ResolutionContext, ResolutionAction
from app.services.resolution import ResolutionService

router = APIRouter()

class BulkActionRequest(BaseModel):
    job_id: str
    item_ids: List[str]
    action: ResolutionAction

@router.get("/jobs/{job_id}/resolution-context", response_model=ResolutionContext)
async def get_resolution_context(job_id: str):
    """
    Returns the Mutable Operational State (Header Stats).
    Does NOT return analytical data.
    """
    return ResolutionService.get_context(job_id)

@router.get("/jobs/{job_id}/cluster/{cluster_id}", response_model=List[dict])
async def get_cluster_rows(job_id: str, cluster_id: str):
    """
    Returns Raw Rows for the Diverging View.
    Includes 'status' field (RESOLVED/UNRESOLVED).
    """
    # Note: cluster_id 'all' returns all? Or make optional?
    # Router expects string. 
    cid = None if cluster_id == "all" else cluster_id
    return ResolutionService.get_cluster_rows(job_id, cid)

@router.post("/bulk", response_model=ResolutionContext)
async def apply_bulk_action(payload: BulkActionRequest):
    """
    Mutates Resolution State.
    Returns updated Context.
    """
    return ResolutionService.apply_bulk_action(
        job_id=payload.job_id,
        item_ids=payload.item_ids,
        action=payload.action
    )

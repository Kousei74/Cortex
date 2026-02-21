from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime
import os
import json

router = APIRouter()

# --- Schemas ---

class ResolutionAction(BaseModel):
    item_ids: List[str] = Field(..., min_items=1, description="List of IDs to resolve")
    action_type: Literal["KEEP", "DELETE", "MERGE", "IGNORE"]
    target_cluster: Optional[str] = None # For merge operations
    reason: Optional[str] = None

class ResolutionResponse(BaseModel):
    job_id: str
    status: Literal["processing", "completed", "failed"]
    affected_count: int
    message: str

class ResolutionRow(BaseModel):
    ID: str
    Title: str
    Cluster: str
    Sentiment: Optional[float] = None
    Confidence: Optional[float] = None
    
# --- Logic ---

@router.post("/bulk", response_model=ResolutionResponse)
async def bulk_resolve(payload: ResolutionAction, background_tasks: BackgroundTasks):
    """
    Apply a resolution action to a set of items.
    This is an ATOMIC operation (simulated for V1).
    """
    
    # 1. Validation (Simulated)
    if payload.action_type == "MERGE" and not payload.target_cluster:
        raise HTTPException(status_code=400, detail="Target cluster required for MERGE action")

    # 2. Logic (Mock for V1 - will be connected to DB later)
    # in V2 this would update the 'status' column in DB
    
    # 3. Background Task: Invalidate Cache or Update Index
    background_tasks.add_task(process_resolution_background, payload)

    return ResolutionResponse(
        job_id=f"res_{datetime.now().timestamp()}",
        status="processing",
        affected_count=len(payload.item_ids),
        message=f"Queued {payload.action_type} for {len(payload.item_ids)} items"
    )

@router.get("/rows/{job_id}", response_model=List[Dict[str, Any]])
async def get_resolution_rows(job_id: str):
    """
    Fetch the raw rows for the resolution table.
    Reads from the JSON artifact generated during analysis.
    """
    # Sanitize job_id to prevent traversal
    safe_job_id = os.path.basename(job_id)
    file_path = f"uploads/{safe_job_id}_resolution.json"
    
    if not os.path.exists(file_path):
        # Mock data if file doesn't exist (for development/testing)
        # return []
        raise HTTPException(status_code=404, detail="Resolution data not found for this job")
        
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            # Limit to 1000 for V1 safety
            return data[:1000]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load resolution data: {str(e)}")

async def process_resolution_background(payload: ResolutionAction):
    # Simulate work
    import asyncio
    await asyncio.sleep(0.5)
    print(f"[ResolutionWorker] Processed {payload.action_type} on {len(payload.item_ids)} items.")

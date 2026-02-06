from fastapi import APIRouter, HTTPException, status
from app.schemas.report import ReportRequest, ReportResponse, JobStatus
from app.services.jobs import JobManager
from app.core.queue import QueueService

router = APIRouter()

@router.post("/jobs", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report_job(request: ReportRequest):
    """
    Step 5: Job Handler
    Accepts file_ids, expects 202/201, returns job_id.
    """
    # 1. Create Job (Idempotent)
    job_id, is_existing = JobManager.create_job(request.file_ids, request.project_id)
    
    # 2. Check if new or existing
    job = JobManager.get_job(job_id)
    
    # If PENDING and NEW, enqueue
    if not is_existing and job.status == JobStatus.PENDING:
         await QueueService.enqueue(job_id)

    return ReportResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        error=job.error,
        payload=job.payload,
        is_existing=is_existing
    )

@router.get("/jobs/{job_id}", response_model=ReportResponse)
async def get_report_job(job_id: str):
    """
    Step 6: Polling
    """
    job = JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return ReportResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        error=job.error,
        payload=job.payload
    )

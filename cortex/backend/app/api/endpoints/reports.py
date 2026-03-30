from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.report import ReportRequest, ReportResponse, JobStatus
from app.services.jobs import JobManager
from app.core.queue import QueueService
from app.core.security import SessionUser, get_current_user
from app.core.config import settings

router = APIRouter()

@router.post("/jobs", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report_job(
    request: ReportRequest,
    session_user: SessionUser = Depends(get_current_user),
):
    """
    Step 5: Job Handler
    Accepts file_ids, expects 202/201, returns job_id.
    """
    existing_job_id = JobManager.find_existing_job_id(request.file_ids, session_user.emp_id)
    if existing_job_id:
        job = JobManager.get_job(existing_job_id)
        return ReportResponse(
            job_id=job.job_id,
            status=job.status,
            progress=job.progress,
            error=job.error,
            payload=job.payload,
            is_existing=True
        )

    if JobManager.count_active_jobs_for_owner(session_user.emp_id) >= settings.MAX_ACTIVE_JOBS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can only have {settings.MAX_ACTIVE_JOBS_PER_USER} active report job at a time."
        )

    if JobManager.count_pending_jobs() >= settings.MAX_PENDING_JOBS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Report queue is full right now. Please try again in a moment."
        )

    # 1. Create Job (Idempotent)
    job_id, is_existing = JobManager.create_job(request.file_ids, request.project_id, session_user.emp_id)
    
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
async def get_report_job(
    job_id: str,
    session_user: SessionUser = Depends(get_current_user),
):
    """
    Step 6: Polling
    """
    job = JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.owner_emp_id != session_user.emp_id:
        raise HTTPException(status_code=403, detail="You do not have access to this job")
        
    return ReportResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        error=job.error,
        payload=job.payload
    )

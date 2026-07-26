from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.report import ReportRequest, ReportResponse, JobStatus
from app.services.jobs import JobManager
from app.core.queue import QueueService
from app.core.security import SessionUser, get_current_user
from app.core.config import settings
from app.core.observability import get_logger, instrument_fastapi_router, instrument_module_functions, log_step

router = APIRouter()
logger = get_logger(__name__)

@router.post("/jobs", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report_job(
    request: ReportRequest,
    session_user: SessionUser = Depends(get_current_user),
):
    """
    Step 5: Job Handler
    Accepts file_ids, expects 202/201, returns job_id.
    """
    log_step(
        logger,
        "reports.create.begin",
        owner_emp_id=session_user.emp_id,
        file_count=len(request.file_ids),
        project_id=request.project_id,
    )
    existing_job_id = JobManager.find_existing_job_id(request.file_ids, session_user.emp_id)
    if existing_job_id:
        job = JobManager.get_job(existing_job_id)
        log_step(logger, "reports.create.idempotent_hit", job_id=existing_job_id, status=job.status if job else None)
        return ReportResponse(
            job_id=job.job_id,
            status=job.status,
            progress=job.progress,
            error=job.error,
            payload=job.payload,
            is_existing=True
        )

    if JobManager.count_active_jobs_for_owner(session_user.emp_id) >= settings.MAX_ACTIVE_JOBS_PER_USER:
        log_step(logger, "reports.create.rejected_active_limit", owner_emp_id=session_user.emp_id)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"You can only have {settings.MAX_ACTIVE_JOBS_PER_USER} active report job at a time."
        )

    if JobManager.count_pending_jobs() >= settings.MAX_PENDING_JOBS:
        log_step(logger, "reports.create.rejected_queue_limit", pending=JobManager.count_pending_jobs())
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
         log_step(logger, "reports.create.enqueued", job_id=job_id)

    log_step(logger, "reports.create.success", job_id=job.job_id, status=job.status, is_existing=is_existing)
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
    log_step(logger, "reports.get.begin", job_id=job_id, owner_emp_id=session_user.emp_id)
    job = JobManager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.owner_emp_id != session_user.emp_id:
        raise HTTPException(status_code=403, detail="You do not have access to this job")
        
    log_step(logger, "reports.get.success", job_id=job_id, status=job.status, progress=job.progress)
    return ReportResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        error=job.error,
        payload=job.payload
    )


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions", "instrument_fastapi_router"})
instrument_fastapi_router(router, logger)

from typing import Dict, List, Optional
import uuid
import hashlib
from datetime import datetime
from app.schemas.report import JobStatus, ReportPayload

class Job:
    def __init__(self, job_id: str, file_ids: List[str], project_id: str, owner_emp_id: str):
        self.job_id = job_id
        self.file_ids = file_ids
        self.project_id = project_id
        self.owner_emp_id = owner_emp_id
        self.status = JobStatus.PENDING
        self.progress = 0
        self.error: Optional[str] = None
        self.payload: Optional[ReportPayload] = None
        self.created_at = datetime.utcnow()
        self.processing_started_at: Optional[datetime] = None

# In-Memory Stores
# WARNING: This is a DEVELOPMENT STUB.
# - NOT SUITABLE FOR PRODUCTION
# - LOST ON RESTART
# - NO CONCURRENCY SAFETY
# Must be replaced by Redis/Postgres in Phase C.
# 1. Main Job Store: job_id -> Job
jobs_db: Dict[str, Job] = {}

# 2. Idempotency Index: hash(file_ids) -> job_id
# Prevents duplicate processing for exact same file set
idempotency_index: Dict[str, str] = {}

class JobManager:
    @staticmethod
    def _generate_idempotency_key(file_ids: List[str], owner_emp_id: str) -> str:
        # Sort to ensure order doesn't matter
        sorted_ids = sorted(file_ids)
        combined = f"{owner_emp_id}:{''.join(sorted_ids)}"
        return hashlib.sha256(combined.encode()).hexdigest()

    @staticmethod
    def find_existing_job_id(file_ids: List[str], owner_emp_id: str) -> Optional[str]:
        key = JobManager._generate_idempotency_key(file_ids, owner_emp_id)
        existing_id = idempotency_index.get(key)
        if not existing_id:
            return None

        existing_job = jobs_db.get(existing_id)
        if not existing_job:
            return None

        if existing_job.status == JobStatus.FAILED:
            del idempotency_index[key]
            return None

        return existing_id

    @staticmethod
    def count_active_jobs_for_owner(owner_emp_id: str) -> int:
        return sum(
            1
            for job in jobs_db.values()
            if job.owner_emp_id == owner_emp_id and job.status in {JobStatus.PENDING, JobStatus.PROCESSING}
        )

    @staticmethod
    def count_pending_jobs() -> int:
        return sum(1 for job in jobs_db.values() if job.status == JobStatus.PENDING)

    @staticmethod
    def create_job(file_ids: List[str], project_id: str, owner_emp_id: str) -> tuple[str, bool]:
        """
        Creates a new job or returns existing one if duplicate (Idempotency).
        Returns: (job_id, is_existing)
        Invariant: Idempotency = same file_ids + same logic version -> same job.
        """
        key = JobManager._generate_idempotency_key(file_ids, owner_emp_id)

        existing_id = JobManager.find_existing_job_id(file_ids, owner_emp_id)
        if existing_id:
            return existing_id, True
        
        # Create New
        job_id = str(uuid.uuid4())
        new_job = Job(job_id, file_ids, project_id, owner_emp_id)
        
        jobs_db[job_id] = new_job
        idempotency_index[key] = job_id
        
        return job_id, False

    @staticmethod
    def get_job(job_id: str) -> Optional[Job]:
        return jobs_db.get(job_id)

    @staticmethod
    def update_job_status(job_id: str, status: JobStatus, progress: int = 0, error: str = None, payload: ReportPayload = None):
        # Local import to avoid circular dependency if any (though state.py only imports schema)
        from app.core.state import JobStateMachine, InvalidTransitionError
        
        job = jobs_db.get(job_id)
        if job:
            # 1. Validate Transition
            try:
                JobStateMachine.validate_transition(job.status, status)
            except InvalidTransitionError as e:
                print(f"WARNING: Illegal Transition blocked: {e}")
                # For V1: We BLOCK the update.
                return

            # 2. Monotonic Progress Enforcement
            if status == JobStatus.COMPLETED:
                progress = 100
            elif status == JobStatus.FAILED:
                # Keep last progress or set to 0? Usually keep to show where it died?
                # Let's trust input but ensure it doesn't overshoot
                progress = min(progress, 99) 
            else:
                # PENDING/PROCESSING
                # Ensure monotonic (never decrease)
                if progress < job.progress:
                    # Warning log would go here
                    progress = job.progress 
                # Never hit 100 unless Completed
                if progress >= 100:
                    progress = 99

            job.status = status
            job.progress = progress
            if status == JobStatus.PROCESSING:
                job.processing_started_at = datetime.utcnow()
            elif status in {JobStatus.COMPLETED, JobStatus.FAILED}:
                job.processing_started_at = None
            if error:
                job.error = error
            if payload:
                job.payload = payload
            # If failed, should we release idempotency?
            # Workflow Step 7 mentions Reaper does it. 
            # Immediate fail could also do it.
            if status == JobStatus.FAILED:
                 # Reconstruct key to remove from index? 
                 # We'd need to store key on Job or recompute. Recomputing is cheap.
                 key = JobManager._generate_idempotency_key(job.file_ids, job.owner_emp_id)
                 if key in idempotency_index and idempotency_index[key] == job_id:
                     del idempotency_index[key]

    @staticmethod
    def mark_timed_out(job_id: str, error: str = "TIMEOUT_EXCEEDED") -> None:
        job = jobs_db.get(job_id)
        if not job or job.status == JobStatus.FAILED:
            return
        JobManager.update_job_status(
            job_id,
            JobStatus.FAILED,
            progress=job.progress,
            error=error,
        )

from typing import Dict, List, Optional
import uuid
import hashlib
from datetime import datetime
from app.schemas.report import JobStatus, ReportPayload

class Job:
    def __init__(self, job_id: str, file_ids: List[str], project_id: str):
        self.job_id = job_id
        self.file_ids = file_ids
        self.project_id = project_id
        self.status = JobStatus.PENDING
        self.progress = 0
        self.error: Optional[str] = None
        self.payload: Optional[ReportPayload] = None
        self.created_at = datetime.utcnow()

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
    def _generate_idempotency_key(file_ids: List[str]) -> str:
        # Sort to ensure order doesn't matter
        sorted_ids = sorted(file_ids)
        combined = "".join(sorted_ids)
        return hashlib.sha256(combined.encode()).hexdigest()

    @staticmethod
    def create_job(file_ids: List[str], project_id: str) -> tuple[str, bool]:
        """
        Creates a new job or returns existing one if duplicate (Idempotency).
        Returns: (job_id, is_existing)
        Invariant: Idempotency = same file_ids + same logic version -> same job.
        """
        key = JobManager._generate_idempotency_key(file_ids)
        
        # Check Idempotency
        if key in idempotency_index:
            existing_id = idempotency_index[key]
            # Verify it still exists in DB (could be expired/reaped)
            if existing_id in jobs_db:
                existing_job = jobs_db[existing_id]
                if existing_job.status != JobStatus.FAILED:
                     return existing_id, True
                else:
                    # It failed previously, remove old lock and let it run again
                    del idempotency_index[key]
        
        # Create New
        job_id = str(uuid.uuid4())
        new_job = Job(job_id, file_ids, project_id)
        
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
                 key = JobManager._generate_idempotency_key(job.file_ids)
                 if key in idempotency_index and idempotency_index[key] == job_id:
                     del idempotency_index[key]

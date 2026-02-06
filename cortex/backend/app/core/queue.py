from typing import Optional
import asyncio
from app.services.jobs import JobManager, jobs_db
from app.schemas.report import JobStatus

# Strategy: DB as Queue (Poller) for V1
# Since we are using an in-memory JobManager (Stub) for Phase B/C,
# The QueueService will simply interface with that.
# In a real DB scenario, this would generate SQL queries.

class QueueService:
    @staticmethod
    async def enqueue(job_id: str) -> bool:
        """
        Push job to queue.
        For V1 (DB as Queue): Just ensures status is PENDING.
        """
        # In DB-as-Queue, creating the row with 'pending' IS enqueuing.
        # So this might be a no-op if JobManager.create already sets PENDING.
        # But to be explicit/safe:
        JobManager.update_job_status(job_id, JobStatus.PENDING)
        return True

    @staticmethod
    async def dequeue() -> Optional[str]:
        """
        Fetch next PENDING job.
        Simulates: SELECT * FROM jobs WHERE status='PENDING' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED
        """
        # Scan in-memory DB for oldest pending job
        # Note: This O(N) scan is fine for V1 Stub.
        
        # Sort jobs by creation time to ensure FIFO
        all_jobs = sorted(jobs_db.values(), key=lambda j: j.created_at)
        
        for job in all_jobs:
            if job.status == JobStatus.PENDING:
                # "Lock" it by setting to PROCESSING (or a transient state if we had one)
                # In real PGMQ, dequeue hides it. 
                # Here, we'll return it. The worker immediately marks it PROCESSING.
                return job.job_id
                
        return None

    @staticmethod
    async def ack(job_id: str):
        """
        Acknowledge processing (Remove from queue).
        In DB-as-Queue, this means reaching a terminal state (COMPLETED/FAILED).
        Worker handles state updates, so this might be no-op or sanity check.
        """
        pass

    @staticmethod
    async def nack(job_id: str):
        """
        Negative Ack (Return to queue).
        Reset to PENDING.
        """
        JobManager.update_job_status(job_id, JobStatus.PENDING)

    @staticmethod
    async def reap_stale_jobs(timeout_seconds: int = 60) -> int:
        """
        Reaper: Finds jobs stuck in PROCESSING for > timeout.
        Marks them FAILED.
        Returns count of reaped jobs.
        """
        from datetime import datetime
        
        reaped_count = 0
        now = datetime.utcnow()
        
        # In-memory scan (V1 Stub)
        # In SQL: UPDATE jobs SET status='FAILED' WHERE status='PROCESSING' AND created_at < NOW() - INTERVAL '60s'
        for job in jobs_db.values():
            if job.status == JobStatus.PROCESSING:
                # Calculate duration
                # Note: job.created_at is start time. Ideally we track processing_started_at.
                # But for V1, created_at is close enough proxy if queue valid.
                # Or better, we assume processing started reasonably soon.
                # Let's use created_at for simple reaper.
                duration = (now - job.created_at).total_seconds()
                
                if duration > timeout_seconds:
                    print(f"Reaping stuck job {job.job_id} (Duration: {duration}s)")
                    JobManager.update_job_status(
                        job.job_id,
                        JobStatus.FAILED,
                        error="TIMEOUT_EXCEEDED"
                    )
                    reaped_count += 1
                    
        return reaped_count

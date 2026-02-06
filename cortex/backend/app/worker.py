import asyncio
import time
from app.services.analysis import generate_report_payload
from app.services.jobs import JobManager
from app.core.queue import QueueService
from app.schemas.report import JobStatus

# Config
POLL_INTERVAL_SECONDS = 1

async def worker_loop():
    print("Worker started. Listening for jobs...")
    while True:
        try:
            # 1. Dequeue
            job_id = await QueueService.dequeue()
            
            if not job_id:
                # No jobs, sleep and retry
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue
            
            print(f"Processing Job: {job_id}")
            
            # 2. Get Job Details (to get file_ids)
            job = JobManager.get_job(job_id)
            if not job:
                print(f"Job {job_id} not found in store. Skipping.")
                continue
                
            # 3. Mark Processing
            JobManager.update_job_status(job_id, JobStatus.PROCESSING, progress=0)
            
            # 4. Execute Analysis (CPU Bound)
            # In a real app, this should run in a process pool executor to avoid blocking the async loop
            # For V1 script, direct call is acceptable or thread pool
            loop = asyncio.get_event_loop()
            try:
                # Mock progress updates? AnalysisService is sync and monolithic currently.
                # We'll just update roughly.
                JobManager.update_job_status(job_id, JobStatus.PROCESSING, progress=10)
                
                payload = await loop.run_in_executor(None, generate_report_payload, job.file_ids, job_id)
                
                # 5. Success
                JobManager.update_job_status(
                    job_id, 
                    JobStatus.COMPLETED, 
                    progress=100, 
                    payload=payload
                )
                print(f"Job {job_id} Completed.")
                
            except Exception as e:
                print(f"Job {job_id} Failed: {e}")
                JobManager.update_job_status(
                    job_id, 
                    JobStatus.FAILED, 
                    error=str(e)
                )
            
            # 6. Ack (Optional in DB-as-Queue since status update effectively acks)
            await QueueService.ack(job_id)

        except Exception as e:
            print(f"Worker Loop Error: {e}")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    # Ensure event loop
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        print("Worker stopping...")

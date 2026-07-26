import asyncio

from app.services.jobs import JobManager
from app.services.analysis import generate_report_payload
from app.core.queue import QueueService
from app.core.config import settings
from app.core.observability import configure_logging, get_logger, instrument_module_functions, log_step
from app.schemas.report import JobStatus

# Config
POLL_INTERVAL_SECONDS = 1
REAPER_INTERVAL_SECONDS = settings.WORKER_REAPER_INTERVAL_SECONDS
JOB_TIMEOUT_SECONDS = settings.WORKER_JOB_TIMEOUT_SECONDS
configure_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


async def reaper_loop():
    log_step(logger, "worker.reaper.started", interval_seconds=REAPER_INTERVAL_SECONDS, timeout_seconds=JOB_TIMEOUT_SECONDS)
    while True:
        try:
            reaped_count = await QueueService.reap_stale_jobs(timeout_seconds=JOB_TIMEOUT_SECONDS)
            if reaped_count:
                log_step(logger, "worker.reaper.reaped", count=reaped_count)
        except Exception as e:
            logger.exception("Reaper loop error | error=%s", e)

        await asyncio.sleep(REAPER_INTERVAL_SECONDS)

async def worker_loop():
    log_step(logger, "worker.loop.started", poll_interval_seconds=POLL_INTERVAL_SECONDS)
    while True:
        try:
            # 1. Dequeue
            job_id = await QueueService.dequeue()
            
            if not job_id:
                # No jobs, sleep and retry
                await asyncio.sleep(POLL_INTERVAL_SECONDS)
                continue
            
            log_step(logger, "worker.job.processing", job_id=job_id)
            
            # 2. Get Job Details (to get file_ids)
            job = JobManager.get_job(job_id)
            if not job:
                log_step(logger, "worker.job.missing", job_id=job_id)
                continue
                
            # 3. Mark Processing
            JobManager.update_job_status(job_id, JobStatus.PROCESSING, progress=0)
            
            # 4. Execute Analysis directly in-process
            try:
                JobManager.update_job_status(job_id, JobStatus.PROCESSING, progress=10)
                payload = generate_report_payload(job.file_paths, job_id)

                JobManager.update_job_status(
                    job_id,
                    JobStatus.COMPLETED,
                    progress=100,
                    payload=payload
                )
                log_step(logger, "worker.job.completed", job_id=job_id)
                
            except asyncio.TimeoutError:
                log_step(logger, "worker.job.timeout", job_id=job_id, timeout_seconds=JOB_TIMEOUT_SECONDS)
                JobManager.mark_timed_out(job_id)
            except Exception as e:
                logger.exception("Worker job failed | job_id=%s | error=%s", job_id, e)
                JobManager.update_job_status(
                    job_id, 
                    JobStatus.FAILED, 
                    error=str(e)
                )
            
            # 6. Ack (Optional in DB-as-Queue since status update effectively acks)
            await QueueService.ack(job_id)
            log_step(logger, "worker.job.acked", job_id=job_id)

        except Exception as e:
            logger.exception("Worker loop error | error=%s", e)
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

if __name__ == "__main__":
    # Ensure event loop
    try:
        asyncio.run(worker_loop())
    except KeyboardInterrupt:
        log_step(logger, "worker.loop.stopping")


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions"})

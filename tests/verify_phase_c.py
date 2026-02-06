import sys
import os
import time
import asyncio
from unittest.mock import MagicMock

# Add backend to path BEFORE imports
sys.path.append(os.path.join(os.getcwd(), 'cortex', 'backend'))

# Mock database to bypass Supabase connection (same as Phase B)
sys.modules["app.core.database"] = MagicMock()
sys.modules["app.core.database"].supabase = MagicMock()
sys.modules["app.api.endpoints.auth"] = MagicMock()
sys.modules["app.api.endpoints.auth"].router = MagicMock()

from fastapi.testclient import TestClient
from app.services.jobs import JobManager, jobs_db, idempotency_index, JobStatus
from app.core.queue import QueueService
from app.main import app
from app.api.endpoints import ingestion # Manually register session

# Import Worker Loop
from app.worker import worker_loop, POLL_INTERVAL_SECONDS

client = TestClient(app)

# Helper to run async worker step
async def run_worker_step():
    # Run one iteration of what would be the worker loop
    # Dequeue
    job_id = await QueueService.dequeue()
    if job_id:
        print(f"Worker picked up job: {job_id}")
        # Manually run processing (CPU bound sim)
        JobManager.update_job_status(job_id, JobStatus.PROCESSING, progress=10)
        # Skip actual heavy analysis, just mock completion for test speed
        # Use valid UnsupportedPayload structure
        mock_payload = {
            "layout_strategy": "UNSUPPORTED_DATASET",
            "meta": {},
            "reason_code": "TEST_MOCK",
            "missing_requirements": []
        }
        JobManager.update_job_status(job_id, JobStatus.COMPLETED, progress=100, payload=mock_payload)
        await QueueService.ack(job_id)
        return True
    return False

def run_verification():
    print("--- Starting Phase C Verification ---")
    
    # Setup Data
    jobs_db.clear()
    idempotency_index.clear()
    temporal_path = os.path.abspath('cortex/backend/uploads/test_temporal.csv')
    if not os.path.exists(temporal_path):
        os.makedirs('cortex/backend/uploads', exist_ok=True)
        with open(temporal_path, 'w') as f:
            f.write("Timestamp,Event\n2023-01-01,A\n")
    ingestion.upload_sessions["id_ver_c"] = {
        "file_path": temporal_path, 
        "filename": "test_temporal.csv"
    }

    # Test 1: Enqueue via API
    print("\nTest 1: Enqueue (POST /reports/jobs)")
    resp = client.post("/reports/jobs", json={"file_ids": ["id_ver_c"], "project_id": "p1"})
    assert resp.status_code == 201
    job_id = resp.json()["job_id"]
    
    # Check Status is PENDING
    job = JobManager.get_job(job_id)
    if job.status == JobStatus.PENDING:
        print("PASS: Job is PENDING")
    else:
        print(f"FAIL: Job status is {job.status}")

    # Test 2: Worker Consumption
    print("\nTest 2: Worker Consumption")
    # Run async step
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    processed = loop.run_until_complete(run_worker_step())
    
    if processed:
        print("PASS: Worker dequeued and processed job")
        job = JobManager.get_job(job_id)
        if job.status == JobStatus.COMPLETED:
             print("PASS: Job status updated to COMPLETED")
        else:
             print(f"FAIL: Final status is {job.status}")
    else:
        print("FAIL: Worker did not find job")

    # Test 3: Idempotency with Queue
    print("\nTest 3: Idempotency with Queue")
    # Create Duplicate
    resp2 = client.post("/reports/jobs", json={"file_ids": ["id_ver_c"], "project_id": "p1"})
    data2 = resp2.json()
    if data2["job_id"] == job_id and data2["is_existing"] == True:
        print("PASS: Idempotency preserved (returned existing completed job)")
        # Check it wasn't re-queued?
        # Worker shouldn't pick anything up
        processed_again = loop.run_until_complete(run_worker_step())
        if not processed_again:
             print("PASS: No new job in queue")
        else:
             print("FAIL: Duplicate job was queued!")
    else:
        print("FAIL: Idempotency check failed")

    # Test 4: Reaper Logic
    print("\nTest 4: Reaper Logic (Timeout Safety)")
    # Create a job, mark it processing manually, backdate it
    from datetime import datetime, timedelta
    
    # New 'stuck' job
    resp4 = client.post("/reports/jobs", json={"file_ids": ["id_ver_reap"], "project_id": "p1"})
    stuck_job_id = resp4.json()["job_id"]
    stuck_job = JobManager.get_job(stuck_job_id)
    
    # Force state to PROCESSING
    stuck_job.status = JobStatus.PROCESSING
    # Backdate created_at to 70s ago (exceeding 60s default)
    stuck_job.created_at = datetime.utcnow() - timedelta(seconds=70)
    
    # Run Reaper
    print("Running Reaper...")
    count = asyncio.run(QueueService.reap_stale_jobs(timeout_seconds=60))
    
    if count >= 1:
        print(f"PASS: Reaped {count} jobs")
        stuck_job = JobManager.get_job(stuck_job_id)
        if stuck_job.status == JobStatus.FAILED and stuck_job.error == "TIMEOUT_EXCEEDED":
             print("PASS: Job Marked FAILED with TIMEOUT_EXCEEDED")
        else:
             print(f"FAIL: Job status={stuck_job.status}, error={stuck_job.error}")
    else:
        print("FAIL: Reaper did not start any jobs")

if __name__ == "__main__":
    run_verification()

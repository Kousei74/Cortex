import sys
import os
import unittest
from unittest.mock import MagicMock

# Add backend to path BEFORE imports
sys.path.append(os.path.join(os.getcwd(), 'cortex', 'backend'))

# Mock DB
sys.modules["app.core.database"] = MagicMock()
sys.modules["app.core.database"].supabase = MagicMock()
sys.modules["app.api.endpoints.auth"] = MagicMock()
sys.modules["app.api.endpoints.auth"].router = MagicMock()

from app.services.jobs import JobManager, jobs_db, JobStatus
from app.core.state import InvalidTransitionError

class TestStateMachine(unittest.TestCase):
    def setUp(self):
        jobs_db.clear()
        
    def test_happy_path(self):
        print("\nTest 1: Happy Path")
        # 1. Create
        job_id, _ = JobManager.create_job(["f1"], "p1")
        job = JobManager.get_job(job_id)
        self.assertEqual(job.status, JobStatus.PENDING)
        print("PENDING -> OK")
        
        # 2. Processing
        JobManager.update_job_status(job_id, JobStatus.PROCESSING)
        self.assertEqual(job.status, JobStatus.PROCESSING)
        print("PROCESSING -> OK")
        
        # 3. Completed
        JobManager.update_job_status(job_id, JobStatus.COMPLETED)
        self.assertEqual(job.status, JobStatus.COMPLETED)
        print("COMPLETED -> OK")

    def test_illegal_transition_completed_to_processing(self):
        print("\nTest 2: Illegal (COMPLETED -> PROCESSING)")
        job_id, _ = JobManager.create_job(["f2"], "p1")
        # Advance to COMPLETED
        JobManager.update_job_status(job_id, JobStatus.PROCESSING)
        JobManager.update_job_status(job_id, JobStatus.COMPLETED)
        
        # Try to go back
        JobManager.update_job_status(job_id, JobStatus.PROCESSING)
        
        # Should still be COMPLETED
        job = JobManager.get_job(job_id)
        self.assertEqual(job.status, JobStatus.COMPLETED)
        print("Blocked -> OK")

    def test_illegal_transition_failed_to_processing(self):
        print("\nTest 3: Illegal (FAILED -> PROCESSING)")
        job_id, _ = JobManager.create_job(["f3"], "p1")
        JobManager.update_job_status(job_id, JobStatus.PROCESSING)
        JobManager.update_job_status(job_id, JobStatus.FAILED)
        
        # Try to go back
        JobManager.update_job_status(job_id, JobStatus.PROCESSING)
        
        job = JobManager.get_job(job_id)
        self.assertEqual(job.status, JobStatus.FAILED)
        print("Blocked -> OK")
        
if __name__ == '__main__':
    unittest.main()

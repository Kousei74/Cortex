import sys
import os
import time
from unittest.mock import MagicMock

# Add backend to path BEFORE imports
sys.path.append(os.path.join(os.getcwd(), 'cortex', 'backend'))

# Mock database to bypass Supabase connection
sys.modules["app.core.database"] = MagicMock()
sys.modules["app.core.database"].supabase = MagicMock()

# Mock Auth endpoint to avoid importing it (which imports DB)
sys.modules["app.api.endpoints.auth"] = MagicMock()
sys.modules["app.api.endpoints.auth"].router = MagicMock()

from fastapi.testclient import TestClient
from app.api.endpoints import ingestion, reports
from app.services.jobs import JobManager, jobs_db, idempotency_index
# We need to manually register mock auth router if we import main, 
# but main imports auth. Let's rely on Mock being imported by main.
from app.main import app

client = TestClient(app)

def run_verification():
    print("--- Starting Phase B Verification ---")
    
    # Needs Phase A data to work?
    # Phase A test created files in `cortex/backend/uploads`.
    # Let's ensure we have a valid file to reference.
    temporal_path = os.path.abspath('cortex/backend/uploads/test_temporal.csv')
    if not os.path.exists(temporal_path):
        print("Creating dummy temporal file...")
        os.makedirs('cortex/backend/uploads', exist_ok=True)
        with open(temporal_path, 'w') as f:
            f.write("Timestamp,Event\n2023-01-01,A\n2023-01-02,B")
            
    # Manually register session (mocking ingestion)
    ingestion.upload_sessions["id_ver_b"] = {
        "file_path": temporal_path, 
        "filename": "test_temporal.csv"
    }
    
    # Test 1: Job Creation
    print("\nTest 1: Job Creation (POST /reports/jobs)")
    req_payload = {"file_ids": ["id_ver_b"], "project_id": "proj_1"}
    resp = client.post("/reports/jobs", json=req_payload)
    
    if resp.status_code == 201:
        data = resp.json()
        job_id = data["job_id"]
        status = data["status"]
        is_existing = data.get("is_existing")
        print(f"PASS: Created Job {job_id} with status {status}. is_existing={is_existing}")
        if is_existing:
             print("FAIL: Expected is_existing=False for new job")
    else:
        print(f"FAIL: {resp.status_code} - {resp.text}")
        return

    # Test 2: Idempotency
    print("\nTest 2: Idempotency Check")
    resp2 = client.post("/reports/jobs", json=req_payload)
    if resp2.status_code == 201: # Endpoint returns 201 even for existing? Or 200? Endpoint code says 201 only.
        data2 = resp2.json()
        job_id_2 = data2["job_id"]
        is_existing_2 = data2.get("is_existing")
        
        if job_id == job_id_2:
             print(f"PASS: Returned same Job ID. is_existing={is_existing_2}")
             if is_existing_2:
                 print("PASS: Correctly flagged as existing")
             else:
                 print("FAIL: Expected is_existing=True for duplicate job")
        else:
             print(f"FAIL: Returned different Job IDs: {job_id} vs {job_id_2}")
    else:
         print(f"FAIL: {resp2.status_code}")

    # Test 3: Polling
    print("\nTest 3: Polling (GET /reports/jobs/{job_id})")
    # Wait for background task (Simulated latency is 2s)
    print("Waiting 3s for background task...")
    time.sleep(3)
    
    resp3 = client.get(f"/reports/jobs/{job_id}")
    if resp3.status_code == 200:
        data3 = resp3.json()
        final_status = data3["status"]
        progress = data3["progress"]
        print(f"Result: Status={final_status}, Progress={progress}")
        
        if final_status == "completed":
            print("PASS: Job Completed")
            # Verify Payload
            if data3.get("payload"):
                 print("PASS: Payload present")
            else:
                 print("FAIL: Payload missing")
        else:
            print(f"WARN: Job not completed yet (Status: {final_status}). Increase wait time?")
    else:
        print(f"FAIL: {resp3.status_code}")

if __name__ == "__main__":
    # Clear state
    jobs_db.clear()
    idempotency_index.clear()
    
    run_verification()

import requests
import time
import json

API_BASE = "http://localhost:8000"

def test_phase_3():
    print("=== Phase 3 Verification Start ===")

    # 1. Ingest Data (Mock) & Create Job
    # We rely on existing ingestion flow or just use a known file_id?
    # To be safe, let's just create a job with a dummy file_id? 
    # But Ingestion needs to happen for Analysis to work?
    # Actually, Analysis Service needs real data or it fails?
    # Wait, `analysis.py` `load_dataset` reads from disk.
    # If I don't upload a file, it will fail.
    # I verified Phase B logic which mocks ingestion?
    # Let's try to verify Resolution API *independently* of Job Creation if possible?
    # ResolutionService mocks data based on job_id. It doesn't check if job exists in `jobs.py`.
    # So I can test Resolution API with ANY job_id.
    
    # 2. Test Resolution Context (Mock Data)
    job_id = "test-job-phase3"
    print(f"\n[Step 1] Fetching Resolution Context for {job_id}...")
    res = requests.get(f"{API_BASE}/resolution/jobs/{job_id}/resolution-context")
    if res.status_code != 200:
        print("FAILED: Could not fetch context", res.text)
        return
    
    context = res.json()
    print("Context:", json.dumps(context, indent=2))
    assert context["items_total"] == 100
    assert context["items_remaining"] == 100
    assert "all" in context["clusters"]
    
    # 3. Test Fetch Rows
    print("\n[Step 2] Fetching Rows for cluster 'all'...")
    res = requests.get(f"{API_BASE}/resolution/jobs/{job_id}/cluster/all")
    rows = res.json()
    print(f"Fetched {len(rows)} rows.")
    assert len(rows) == 100
    first_id = rows[0]["id"]
    print(f"First Row ID: {first_id}")
    
    # 4. Test Resolve Action
    print(f"\n[Step 3] Resolving First Item {first_id}...")
    payload = {
        "job_id": job_id,
        "item_ids": [first_id],
        "action": "RESOLVE"
    }
    res = requests.post(f"{API_BASE}/resolution/bulk", json=payload)
    if res.status_code != 200:
        print("FAILED: Resolution Action", res.text)
        return
        
    new_context = res.json()
    print("New Context:", json.dumps(new_context, indent=2))
    assert new_context["items_resolved"] == 1
    assert new_context["items_remaining"] == 99
    
    # 5. Verify Row Status
    print("\n[Step 4] Verifying Row Status Update...")
    res = requests.get(f"{API_BASE}/resolution/jobs/{job_id}/cluster/all")
    rows_updated = res.json()
    target_row = next(r for r in rows_updated if r["id"] == first_id)
    print("Target Row Status:", target_row["status"])
    assert target_row["status"] == "RESOLVED"
    
    print("\n=== Phase 3 Verification Passed ===")

if __name__ == "__main__":
    try:
        test_phase_3()
    except Exception as e:
        print(f"Test Failed: {e}")

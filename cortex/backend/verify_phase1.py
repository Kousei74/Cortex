import os
import requests
import uuid
from datetime import date, datetime, timedelta, timezone
from jose import jwt

# Configuration
BASE_URL = "http://localhost:8000/service"
# Correct SECRET_KEY from .env
SECRET_KEY = "KvPeXESBn5VTb4Ac0/xI3T0ti1Ws5MtkOHDgp+wmhjJ3WhD0swzoiEm1iMiv5yoDhfqyj9FcyFPFMebRI/a+Lg=="
ALGORITHM = "HS256"

def create_test_token(role="senior", emp_id="E001"):
    payload = {
        "user_role": role,
        "emp_id": emp_id,
        "aud": "authenticated",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

TOKEN = create_test_token()

def get_headers():
    return {"Authorization": f"Bearer {TOKEN}"}

def test_phase1():
    print("🚀 Starting Phase 1 Verification...")

    # 1. Create a Root Issue
    issue_data = {
        "type": "new",
        "issue_header": "Phase 1 Test Issue",
        "date": str(date.today()),
        "assigned_teams": ["D01"],
        "priority": "mid",
        "description": "Verification of Phase 1 logic",
        "created_by": "TestBot"
    }
    resp = requests.post(f"{BASE_URL}/issues", json=issue_data, headers=get_headers())
    if resp.status_code != 201:
        print(f"❌ Failed to create issue: {resp.text}")
        return
    issue_id = resp.json()["issue_id"]
    print(f"✅ Created Issue: {issue_id}")

    # 2. Create a Pending Child Node
    node_data = {
        "type": "existing",
        "parent_issue_id": issue_id,
        "issue_subheader": "Pending Node",
        "date": str(date.today()),
        "description": "This is a pending node",
        "created_by": "TestBot",
        "layout_x": 0,
        "layout_y": 160
    }
    resp = requests.post(f"{BASE_URL}/issues/child", json=node_data, headers=get_headers())
    node_id = resp.json()["issue_id"]
    print(f"✅ Created Pending Node: {node_id}")

    # 3. Test Terminal Enforcement (Attempt to add child to pending node)
    child_data = node_data.copy()
    child_data["parent_issue_id"] = node_id
    child_data["issue_subheader"] = "Terminal Test Child"
    resp = requests.post(f"{BASE_URL}/issues/child", json=child_data, headers=get_headers())
    if resp.status_code == 400 and "Terminal Enforcement" in resp.text:
        print("✅ Terminal Enforcement: Blocked child on 'pending' node.")
    else:
        print(f"❌ Terminal Enforcement failed: {resp.status_code} {resp.text}")

    # 4. Create Sibling Yellow Nodes
    yellow_data = node_data.copy()
    yellow_data["issue_subheader"] = "Yellow Sibling"
    resp = requests.post(f"{BASE_URL}/issues/child", json=yellow_data, headers=get_headers())
    yellow_id = resp.json()["issue_id"]
    
    # Tag it yellow
    requests.patch(f"{BASE_URL}/issues/{yellow_id}/tag", json={"tag": "yellow", "role": "senior"}, headers=get_headers())
    print(f"✅ Created Yellow Sibling: {yellow_id}")

    # 5. Create ANOTHER sibling (pending) and verify yellow stays
    print("Creating another pending sibling...")
    pending_data = node_data.copy()
    pending_data["issue_subheader"] = "Persistence Test Pending"
    resp = requests.post(f"{BASE_URL}/issues/child", json=pending_data, headers=get_headers())
    new_pending_id = resp.json()["issue_id"]
    
    # Check if yellow sibling still exists
    resp = requests.get(f"{BASE_URL}/issues/{issue_id}/graph", headers=get_headers())
    node_ids = [n["id"] for n in resp.json()["nodes"]]
    if yellow_id in node_ids:
        print("✅ Yellow Persistence: Yellow sibling stayed after new pending creation.")
    else:
        print("❌ Yellow Persistence FAILED: Yellow sibling vanished after new pending creation.")
        return

    # 6. Promote Pending Node to Green and Check Yellow Stacking
    # First get the node to see its updated_at for OCC
    resp = requests.get(f"{BASE_URL}/issues/{issue_id}/graph", headers=get_headers())
    nodes = resp.json()["nodes"]
    target_node = next(n for n in nodes if n["id"] == node_id)
    last_updated_at = target_node["data"]["updated_at"]

    print("Promoting node to Green...")
    resp = requests.patch(f"{BASE_URL}/issues/{node_id}/tag", json={
        "tag": "green", 
        "last_updated_at": last_updated_at,
        "role": "senior"
    }, headers=get_headers())
    
    if resp.status_code == 200:
        print("✅ Tagged Green successfully.")
    else:
        print(f"❌ Failed to tag green: {resp.text}")

    # Check if yellow sibling is deleted
    resp = requests.get(f"{BASE_URL}/issues/{issue_id}/graph", headers=get_headers())
    node_ids = [n["id"] for n in resp.json()["nodes"]]
    if yellow_id not in node_ids:
        print("✅ Yellow Stacking: Yellow sibling auto-deleted.")
    else:
        print("❌ Yellow Stacking failed: Yellow sibling still exists.")

    # 6. Test OCC Conflict
    print("Testing OCC Conflict...")
    resp = requests.patch(f"{BASE_URL}/issues/{node_id}/tag", json={
        "tag": "blue", 
        "last_updated_at": "1970-01-01T00:00:00Z", # Stale timestamp
        "senior_comment": "Testing OCC",
        "role": "senior"
    }, headers=get_headers())
    
    if resp.status_code == 409:
        print("✅ OCC: Successfully blocked stale update (409 Conflict).")
    else:
        print(f"❌ OCC failed: Expected 409, got {resp.status_code} {resp.text}")

    print("\n🏁 Phase 1 Verification Complete.")

if __name__ == "__main__":
    test_phase1()

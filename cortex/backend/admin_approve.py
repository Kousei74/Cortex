import sys
import os
import uuid
from datetime import datetime, timezone, timedelta
import secrets

# Add backend directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import service_role_supabase as supabase

def generate_invite_token():
    return secrets.token_urlsafe(32)

def list_pending_requests():
    print("\n--- PENDING ACCESS REQUESTS ---")
    res = supabase.table("access_requests").select("*").eq("status", "pending").execute()
    requests = res.data
    
    if not requests:
        print("No pending requests.")
        return None
        
    for i, req in enumerate(requests):
        print(f"[{i + 1}] {req['full_name']} ({req['email']}) - Requested at: {req['created_at']}")
        
    return requests

def approve_request(req):
    print(f"\nApproving request for {req['email']}...")
    dept_id = input("Enter Department ID (e.g. dev1, sales, hr): ").strip()
    if not dept_id:
        print("Department ID is required. Aborting.")
        return
        
    role = input("Enter Role [default: team_member]: ").strip()
    if not role:
        role = "team_member"
        
    token = generate_invite_token()
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    
    # Invalidate older unused invites for this request
    supabase.table("invite_tokens").delete().eq("request_id", req["id"]).execute()
    
    # Create the new invite
    invite_data = {
        "request_id": req["id"],
        "email": req["email"],
        "dept_id": dept_id,
        "role": role,
        "token_hash": token,
        "expires_at": expires_at
    }
    
    # Mark as approved
    supabase.table("access_requests").update({"status": "approved"}).eq("id", req["id"]).execute()
    
    # Store token
    supabase.table("invite_tokens").insert(invite_data).execute()
    
    print("\n--- SUCCESSFULLY APPROVED ---")
    print(f"Email: {req['email']}")
    print(f"Dept: {dept_id}")
    print(f"Role: {role}")
    print(f"Invite Token: {token}")
    print(f"\nGive this link to the user:")
    print(f"http://localhost:5173/signup?token={token}\n")

def main():
    while True:
        requests = list_pending_requests()
        if not requests:
            break
            
        choice = input("\nEnter the number of the request to approve (or 'q' to quit): ").strip()
        if choice.lower() == 'q':
            break
            
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(requests):
                approve_request(requests[idx])
            else:
                print("Invalid number.")
        except ValueError:
            print("Please enter a valid number or 'q'.")

if __name__ == "__main__":
    main()

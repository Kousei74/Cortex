import os
import json
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not url or not key:
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("SUPABASE_URL="):
                url = line.strip().split("=", 1)[1]
            elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                key = line.strip().split("=", 1)[1]

supabase: Client = create_client(url, key)

res = supabase.table("issues").select("id").order("created_at", desc=True).limit(1).execute()
if not res.data:
    print("No issues.")
    exit()

issue_id = res.data[0]["id"]
print(f"Latest Issue: {issue_id}")

nodes = supabase.table("issue_nodes").select("id, root_issue_id, parent_node_id, tag, layout_x, layout_y").eq("root_issue_id", issue_id).execute()
print(json.dumps(nodes.data, indent=2))

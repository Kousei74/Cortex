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

output_nodes = []
output_edges = []

for n in nodes.data:
    output_nodes.append({
        "id": n["id"],
        "layout_x": n.get("layout_x"),
        "layout_y": n.get("layout_y")
    })
    parent_id = n.get("parent_node_id") or n.get("root_issue_id")
    if parent_id:
        output_edges.append({
            "id": f"e-{parent_id}-{n['id']}",
            "source": parent_id,
            "target": n["id"]
        })

print("NODES:", json.dumps(output_nodes, indent=2))
print("EDGES:", json.dumps(output_edges, indent=2))

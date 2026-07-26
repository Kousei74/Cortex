import asyncio
import os
import json
from supabase import create_client, Client
from app.api.endpoints.service_hub import get_issue_graph

async def main():
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
    issue_id = res.data[0]["id"]
    
    graph = await get_issue_graph(issue_id=issue_id, supabase=supabase)
    print("API RESPONSE:")
    print(json.dumps(graph, indent=2))

asyncio.run(main())

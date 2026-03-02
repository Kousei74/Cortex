from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import date, datetime, timedelta
import httpx
import uuid

from app.core.config import settings
from app.core.database import supabase

router = APIRouter()


# ─── Priority ────────────────────────────────────────────────────────────────
PRIORITY_VALUES = Literal["critical", "high", "mid", "low"]
PRIORITY_ORDER  = ["critical", "high", "mid", "low"]

def _priority_index(p: str) -> int:
    return PRIORITY_ORDER.index(p) if p in PRIORITY_ORDER else -1


# ─── Issue Schemas ────────────────────────────────────────────────────────────

class NewIssueRequest(BaseModel):
    type: Literal["new"] = "new"
    issue_header: str = Field(..., min_length=1, max_length=120)
    date: date
    assigned_team: Optional[str] = None
    priority: PRIORITY_VALUES
    description: str = Field(..., min_length=1, max_length=2000)
    created_by: str
    emp_id: str
    dept_id: Optional[str] = None
    parent_ticket: Optional[str] = None
    chained_to: Optional[str] = None

class ExistingIssueRequest(BaseModel):
    type: Literal["existing"] = "existing"
    parent_issue_id: str = Field(..., min_length=1)
    issue_subheader: str = Field(..., min_length=1, max_length=120)
    date: date
    description: str = Field(..., min_length=1, max_length=2000)
    created_by: str
    emp_id: str
    dept_id: Optional[str] = None

class IssueTagRequest(BaseModel):
    tag: Literal["pending", "yellow", "blue", "green", "red"]

class IssueMergeRequest(BaseModel):
    target_parent_id: str
    branch_nodes: List[str] # IDs of the blue branch nodes being merged
    metadata_summary: str
    emp_id: str
    dept_id: Optional[str] = None

class IssueResponse(BaseModel):
    issue_id: str
    type: str
    status: str
    message: str
    parent_id: Optional[str] = None

# ─── Helper Functions ────────────────────────────────────────────────────────

def delete_issue_subtree(node_id: str):
    """
    Deletes a node and relies on Postgres ON DELETE CASCADE to remove children.
    """
    supabase.table("issues").delete().eq("issue_id", node_id).execute()


# ─── Issue Endpoints ─────────────────────────────────────────────────────────

@router.post("/issues", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(request: NewIssueRequest):
    issue_id = f"ISS-{str(uuid.uuid4())[:8].upper()}"
    data = {
        "issue_id": issue_id,
        "type": "new",
        "header": request.issue_header,
        "date": str(request.date),
        "assigned_team": request.assigned_team,
        "priority": request.priority,
        "description": request.description,
        "created_by": request.created_by,
        "emp_id": request.emp_id,
        "dept_id": request.dept_id,
        "created_at": datetime.now().isoformat(),
        "parent_ticket": request.parent_ticket,
        "chained_to": request.chained_to,
        "tag": "green", # Root issue nodes act as green truth anchors
        "status": "open",
        "last_activity": datetime.now().isoformat()
    }
    
    try:
        supabase.table("issues").insert(data).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
        
    return IssueResponse(issue_id=issue_id, type="new", status="open", message="Issue filed successfully.")


@router.post("/issues/child", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_child_issue(request: ExistingIssueRequest):
    res = supabase.table("issues").select("*").eq("issue_id", request.parent_issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail=f"Parent issue '{request.parent_issue_id}' not found.")
    parent = res.data[0]

    if parent.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Cannot add nodes to a closed issue.")

    # Apply Ruthless Cleanliness Rule: If ANY sibling has tag "yellow" or "red", they instantly vanish
    sibs_res = supabase.table("issues").select("issue_id, tag").eq("parent_id", request.parent_issue_id).execute()
    for sib in sibs_res.data:
        if sib.get("tag") in ["yellow", "red"]:
            delete_issue_subtree(sib["issue_id"])

    issue_id = f"NODE-{str(uuid.uuid4())[:8].upper()}"
    data = {
        "issue_id": issue_id,
        "type": "existing",
        "parent_id": request.parent_issue_id,
        "header": request.issue_subheader,
        "date": str(request.date),
        "description": request.description,
        "created_by": request.created_by,
        "emp_id": request.emp_id,
        "dept_id": request.dept_id,
        "created_at": datetime.now().isoformat(),
        "tag": "pending", # Requires senior tagging
        "status": "open",
    }
    
    try:
        supabase.table("issues").insert(data).execute()
        
        # Update last activity of the root issue
        root_id = request.parent_issue_id
        while True:
            r_res = supabase.table("issues").select("parent_id").eq("issue_id", root_id).execute()
            if not r_res.data or not r_res.data[0].get("parent_id"):
                break
            root_id = r_res.data[0]["parent_id"]
            
        supabase.table("issues").update({"last_activity": datetime.now().isoformat()}).eq("issue_id", root_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
        
    return IssueResponse(issue_id=issue_id, type="existing", status="open",
                         message="Node added successfully. Awaiting Senior Review.", parent_id=request.parent_issue_id)


@router.patch("/issues/{issue_id}/tag")
async def tag_issue_node(issue_id: str, request: IssueTagRequest):
    res = supabase.table("issues").select("*").eq("issue_id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
    
    if node.get("type") == "new":
        raise HTTPException(status_code=400, detail="Cannot arbitrarily tag root issue nodes.")

    # Ruthless pruning for Red nodes at the end of Blue branches
    if request.tag == "red" and node.get("tag") == "blue":
        # System axing a blue branch - delete branch
        delete_issue_subtree(issue_id)
        return {"message": "Blue branch rotting limb pruned successfully."}

    supabase.table("issues").update({"tag": request.tag}).eq("issue_id", issue_id).execute()
    return {"message": f"Node {issue_id} tagged as {request.tag}", "node": {**node, "tag": request.tag}}


@router.post("/issues/merge")
async def merge_blue_branch(request: IssueMergeRequest):
    res = supabase.table("issues").select("*").eq("issue_id", request.target_parent_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Target parent not found.")
        
    issue_id = f"MERGE-{str(uuid.uuid4())[:8].upper()}"
    
    # Collapse the blue branch (remove nodes from graph, store metadata inside truth pill)
    branch_history = []
    for b_id in request.branch_nodes:
        b_res = supabase.table("issues").select("*").eq("issue_id", b_id).execute()
        if b_res.data:
            node = b_res.data[0]
            # Convert datetime objects if any, mostly strings though
            branch_history.append(node)
            delete_issue_subtree(b_id)
            
    data = {
        "issue_id": issue_id,
        "type": "merged_truth",
        "parent_id": request.target_parent_id,
        "header": "Merged Truth Pill",
        "description": request.metadata_summary,
        "emp_id": request.emp_id,
        "dept_id": request.dept_id,
        "created_by": "System Auto-Merge",
        "date": str(date.today()),
        "metadata": {"branch_history": branch_history}, # Embedded metadata
        "created_at": datetime.now().isoformat(),
        "tag": "green",
        "status": "open",
    }
    
    try:
        supabase.table("issues").insert(data).execute()
    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
         
    return {"message": "Branch collapsed into Green Truth Pill.", "issue_id": issue_id}


@router.delete("/issues/{issue_id}")
async def delete_issue_node(issue_id: str):
    res = supabase.table("issues").select("*").eq("issue_id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
        
    if node.get("type") == "new":
        raise HTTPException(status_code=400, detail="Cannot delete root issues. Close them instead.")
        
    created_at = datetime.fromisoformat(node["created_at"])
    # 30 minute offset logic mapped dynamically, typically the client enforces auth match first
    if datetime.now() - created_at > timedelta(minutes=30):
        # Allow seniors to delete via an active JWT check if implemented, otherwise block
        # For this prototype we will enforce 30 mins universally apart from explicit Senior DB-level RLS overrides
        raise HTTPException(status_code=403, detail="30-minute delete window has expired. Node is permanent.")
        
    if node.get("tag") != "pending":
         raise HTTPException(status_code=403, detail="Cannot delete a node that has already been evaluated by a Senior.")

    delete_issue_subtree(issue_id)
    return {"message": "Node deleted successfully within window."}


@router.post("/issues/{issue_id}/close")
async def close_issue(issue_id: str):
    res = supabase.table("issues").select("*").eq("issue_id", issue_id).execute()
    if not res.data or res.data[0].get("type") != "new":
        raise HTTPException(status_code=404, detail="Root issue not found.")
    issue = res.data[0]
        
    # Check if any active blue branches exist
    all_res = supabase.table("issues").select("*").execute()
    all_nodes = all_res.data
    
    def has_blue(node_id):
        # Simple recursive check in-memory for this issue tree
        children = [n for n in all_nodes if n.get("parent_id") == node_id]
        for c in children:
            if c.get("tag") == "blue": return True
            if has_blue(c["issue_id"]): return True
        return False
        
    if has_blue(issue_id):
        raise HTTPException(status_code=400, detail="Cannot close issue while active Blue branches exist.")
        
    supabase.table("issues").update({"status": "closed", "last_activity": datetime.now().isoformat()}).eq("issue_id", issue_id).execute()
    return {"message": "Issue closed successfully."}


@router.get("/issues", response_model=list)
async def list_issues(status: str = "open", limit: int = 50, dept_id: str = None, emp_id: str = None, role: str = "team_member"):
    """Returns root issues sorted by last activity descending. Implements Python level RBAC matching SQL RLS."""
    query = supabase.table("issues").select("*").eq("type", "new").eq("status", status)
    res = query.execute()
    all_roots = res.data
    
    # Filter by user scope (Python-level RBAC to simulate RLS logic when using Service Key)
    accessible = []
    six_months_ago = datetime.now() - timedelta(days=180)
    
    for issue in all_roots:
        if status == "closed":
            act = datetime.fromisoformat(issue.get("last_activity")) if issue.get("last_activity") else datetime.fromisoformat(issue.get("created_at"))
            # remove timezone info for comparison if it exists
            if act.tzinfo: act = act.replace(tzinfo=None)
            if act < six_months_ago:
                continue
                
        # Access control
        if role == "senior":
            accessible.append(issue)
        elif issue.get("emp_id") == emp_id:
            accessible.append(issue)
        elif issue.get("dept_id") == dept_id:
             accessible.append(issue)
        elif issue.get("assigned_team") == dept_id:
             accessible.append(issue)
            
    accessible.sort(key=lambda x: x.get("last_activity", x.get("created_at", "")), reverse=True)
    return accessible[:limit]


@router.get("/issues/{issue_id}/graph")
async def get_issue_graph(issue_id: str):
    """Returns the DAG representation for the React Flow frontend."""
    res = supabase.table("issues").select("*").execute()
    all_data = res.data
    
    root = next((n for n in all_data if n["issue_id"] == issue_id), None)
    if not root:
        raise HTTPException(status_code=404, detail="Issue not found.")
        
    nodes = []
    edges = []
    
    def traverse(node_id):
        node = next((n for n in all_data if n["issue_id"] == node_id), None)
        if not node: return
        
        nodes.append({
            "id": node["issue_id"],
            "data": {
                "label": node.get("header", node.get("issue_id")),
                "tag": node.get("tag", "pending"),
                "author": node.get("created_by", "Unknown"),
                "description": node.get("description", ""),
                "created_at": node.get("created_at"),
                "type": node.get("type")
            }
        })
        
        children = [n for n in all_data if n.get("parent_id") == node_id]
        for child in children:
            child_id = child["issue_id"]
            edges.append({
                "id": f"e-{node_id}-{child_id}",
                "source": node_id,
                "target": child_id
            })
            traverse(child_id)
            
    traverse(issue_id)
    return {"nodes": nodes, "edges": edges}

@router.get("/issues/{issue_id}", response_model=dict)
async def get_issue(issue_id: str):
    res = supabase.table("issues").select("*").eq("issue_id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Issue not found.")
    return res.data[0]


# ─── Slack OAuth Endpoints ────────────────────────────────────────────────────

SLACK_SCOPES = "channels:history,channels:read,users:read"

@router.get("/slack/authorize")
async def slack_authorize():
    if not settings.SLACK_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Slack integration is not configured.")
    url = (
        "https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.SLACK_CLIENT_ID}"
        f"&scope={SLACK_SCOPES}"
        f"&redirect_uri={settings.SLACK_REDIRECT_URI}"
    )
    return RedirectResponse(url=url)


@router.get("/slack/callback")
async def slack_callback(code: str = None, error: str = None):
    if error or not code:
        return RedirectResponse(f"{settings.FRONTEND_URL}?slack_error={error or 'unknown'}")

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://slack.com/api/oauth.v2.access", data={
            "client_id":     settings.SLACK_CLIENT_ID,
            "client_secret": settings.SLACK_CLIENT_SECRET,
            "code":          code,
            "redirect_uri":  settings.SLACK_REDIRECT_URI,
        })

    data = resp.json()
    if not data.get("ok"):
        return RedirectResponse(f"{settings.FRONTEND_URL}?slack_error={data.get('error','oauth_failed')}")

    token = data.get("authed_user", {}).get("access_token") or data.get("access_token", "")
    return RedirectResponse(f"{settings.FRONTEND_URL}?slack_token={token}")


@router.get("/slack/messages")
async def slack_messages(token: str, oldest: float = 0.0, limit: int = 10):
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient() as client:
        ch_resp = await client.get("https://slack.com/api/users.conversations", headers=headers, params={
            "types": "public_channel,private_channel",
            "limit": 20,
        })
        ch_data = ch_resp.json()
        if not ch_data.get("ok"):
            raise HTTPException(status_code=401, detail=f"Slack error: {ch_data.get('error')}")

        channels = ch_data.get("channels", [])
        messages = []
        for ch in channels[:5]: 
            msg_resp = await client.get("https://slack.com/api/conversations.history", headers=headers, params={
                "channel": ch["id"],
                "oldest":  str(oldest) if oldest else "0",
                "limit":   20,
            })
            msg_data = msg_resp.json()
            if not msg_data.get("ok"):
                continue

            for m in msg_data.get("messages", []):
                if m.get("type") == "message" and not m.get("subtype"):
                    messages.append({
                        "channel": ch.get("name", ch["id"]),
                        "user":    m.get("user", ""),
                        "text":    m.get("text", ""),
                        "ts":      float(m.get("ts", 0)),
                    })

    messages.sort(key=lambda x: x["ts"])
    return messages[-limit:]


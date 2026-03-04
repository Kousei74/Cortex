from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import date, datetime, timedelta
import httpx
import uuid

from app.core.config import settings
from app.core.database import get_supabase
from supabase import Client

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

# ─── Issue Endpoints ─────────────────────────────────────────────────────────

@router.post("/issues", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(request: NewIssueRequest, supabase: Client = Depends(get_supabase)):
    issue_id = f"ISS-{str(uuid.uuid4())[:8].upper()}"
    data = {
        "id": issue_id,
        "header": request.issue_header,
        "description": request.description,
        "priority": request.priority,
        "status": "open",
        "created_by_emp_id": request.emp_id,
        "assigned_dept_id": request.assigned_team,
        "dept_id": request.dept_id,
        "parent_external_ticket": request.parent_ticket,
        "chained_issue_id": request.chained_to,
        "created_at": datetime.now().isoformat(),
        "last_activity_at": datetime.now().isoformat()
    }
    
    try:
        supabase.table("issues").insert(data).execute()
        
        # Also create initial assignment history entry if assigned team is provided
        if request.assigned_team:
            supabase.table("issue_assignments_history").insert({
                "issue_id": issue_id,
                "assigned_dept_id": request.assigned_team,
                "assigned_by_emp_id": request.emp_id,
                "assigned_at": datetime.now().isoformat()
            }).execute()
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
        
    return IssueResponse(issue_id=issue_id, type="new", status="open", message="Issue filed successfully.")


@router.post("/issues/child", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_child_issue(request: ExistingIssueRequest, supabase: Client = Depends(get_supabase)):
    # Determine the root issue tracking. The frontend parent_issue_id could be a root issue OR a child node.
    # Check if parent is a root issue:
    res = supabase.table("issues").select("id, status").eq("id", request.parent_issue_id).execute()
    
    if res.data:
        root_id = res.data[0]["id"]
        status = res.data[0]["status"]
    else:
        # Check if parent is a node instead
        node_res = supabase.table("issue_nodes").select("id, root_issue_id").eq("id", request.parent_issue_id).execute()
        if not node_res.data:
            raise HTTPException(status_code=404, detail=f"Parent issue '{request.parent_issue_id}' not found.")
        root_id = node_res.data[0]["root_issue_id"]
        
        root_res = supabase.table("issues").select("status").eq("id", root_id).execute()
        status = root_res.data[0]["status"] if root_res.data else "closed"

    if status == "closed":
        raise HTTPException(status_code=400, detail="Cannot add nodes to a closed issue.")

    # Apply Ruthless Cleanliness Rule: If ANY sibling node has tag "yellow" or "red", they instantly vanish
    sibs_res = supabase.table("issue_nodes").select("id, tag").eq("parent_node_id", request.parent_issue_id).execute()
    for sib in sibs_res.data:
        if sib.get("tag") in ["yellow", "red"]:
            supabase.table("issue_nodes").delete().eq("id", sib["id"]).execute()

    node_id = f"NODE-{str(uuid.uuid4())[:8].upper()}"
    data = {
        "id": node_id,
        "root_issue_id": root_id,
        "parent_node_id": request.parent_issue_id,
        "header": request.issue_subheader,
        "description": request.description,
        "node_type": "update",
        "tag": "pending",
        "created_by_emp_id": request.emp_id,
        "dept_id": request.dept_id,
        "created_at": datetime.now().isoformat()
    }
    
    try:
        supabase.table("issue_nodes").insert(data).execute()
        supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", root_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
        
    return IssueResponse(issue_id=node_id, type="existing", status="open",
                         message="Node added successfully. Awaiting Senior Review.", parent_id=request.parent_issue_id)


@router.patch("/issues/{issue_id}/tag")
async def tag_issue_node(issue_id: str, request: IssueTagRequest, supabase: Client = Depends(get_supabase)):
    if issue_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot arbitrarily tag root issue nodes. They remain source of truth.")

    res = supabase.table("issue_nodes").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
    
    # Ruthless pruning for Red nodes at the end of Blue branches
    if request.tag == "red" and node.get("tag") == "blue":
        # System axing a blue branch - delete branch entirely (relies on cascade if applicable, else delete self)
        supabase.table("issue_nodes").delete().eq("id", issue_id).execute()
        return {"message": "Blue branch rotting limb pruned successfully."}

    supabase.table("issue_nodes").update({"tag": request.tag}).eq("id", issue_id).execute()
    return {"message": f"Node {issue_id} tagged as {request.tag}", "node": {**node, "tag": request.tag}}


@router.post("/issues/merge")
async def merge_blue_branch(request: IssueMergeRequest, supabase: Client = Depends(get_supabase)):
    # Verify the target parent exists and find the root
    p_res = supabase.table("issues").select("id").eq("id", request.target_parent_id).execute()
    n_res = supabase.table("issue_nodes").select("id, root_issue_id").eq("id", request.target_parent_id).execute()
    
    if p_res.data:
        root_id = request.target_parent_id
    elif n_res.data:
        root_id = n_res.data[0]["root_issue_id"]
    else:
        raise HTTPException(status_code=404, detail="Target parent not found.")
        
    issue_id = f"MERGE-{str(uuid.uuid4())[:8].upper()}"
    
    try:
        data = {
            "id": issue_id,
            "root_issue_id": root_id,
            "parent_node_id": request.target_parent_id,
            "header": "Merged Truth Pill",
            "description": request.metadata_summary,
            "node_type": "merged_truth",
            "tag": "green",
            "created_by_emp_id": request.emp_id,
            "dept_id": request.dept_id,
            "created_at": datetime.now().isoformat()
        }
        supabase.table("issue_nodes").insert(data).execute()
        
        # Collapse the blue branch
        for b_id in request.branch_nodes:
            b_res = supabase.table("issue_nodes").select("*").eq("id", b_id).execute()
            if b_res.data:
                node = b_res.data[0]
                meta = {
                    "merge_node_id": issue_id,
                    "original_node_id": node["id"],
                    "historical_header": node["header"],
                    "historical_description": node["description"],
                    "historical_created_by": node["created_by_emp_id"],
                    "historical_created_at": node["created_at"]
                }
                supabase.table("issue_node_metadata").insert(meta).execute()
                supabase.table("issue_nodes").delete().eq("id", b_id).execute()
                
        supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", root_id).execute()

    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
         
    return {"message": "Branch collapsed into Green Truth Pill.", "issue_id": issue_id}


@router.delete("/issues/{issue_id}")
async def delete_issue_node(issue_id: str, supabase: Client = Depends(get_supabase)):
    if issue_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot delete root issues. Close them instead.")
        
    res = supabase.table("issue_nodes").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
        
    created_at = datetime.fromisoformat(node["created_at"])
    # 30 minute offset logic mapped dynamically, typically the client enforces auth match first
    # Server-side validation of the 30 minute rule to prevent API abuse
    if datetime.now() - created_at > timedelta(minutes=30):
        # Allow seniors to delete via an active JWT check if implemented, otherwise block
        raise HTTPException(status_code=403, detail="30-minute delete window has expired. Node is permanent.")
        
    if node.get("tag") != "pending":
         raise HTTPException(status_code=403, detail="Cannot delete a node that has already been evaluated by a Senior.")

    supabase.table("issue_nodes").delete().eq("id", issue_id).execute()
    return {"message": "Node deleted successfully within window."}


@router.post("/issues/{issue_id}/close")
async def close_issue(issue_id: str, supabase: Client = Depends(get_supabase)):
    res = supabase.table("issues").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Root issue not found.")
        
    # Check if any active blue branches exist under this issue
    blue_res = supabase.table("issue_nodes").select("id").eq("root_issue_id", issue_id).eq("tag", "blue").execute()
    if blue_res.data:
        raise HTTPException(status_code=400, detail="Cannot close issue while active Blue branches exist.")
        
    supabase.table("issues").update({"status": "closed", "last_activity_at": datetime.now().isoformat()}).eq("id", issue_id).execute()
    return {"message": "Issue closed successfully."}


@router.get("/issues", response_model=list)
async def list_issues(status: str = "open", limit: int = 50, dept_id: str = None, emp_id: str = None, role: str = "team_member", supabase: Client = Depends(get_supabase)):
    """Returns root issues sorted by last activity descending. Implements Python level RBAC matching SQL RLS."""
    query = supabase.table("issues").select("*").eq("status", status)
    res = query.execute()
    all_roots = res.data
    
    # Filter by user scope (Python-level RBAC to simulate RLS logic when using Service Key)
    accessible = []
    six_months_ago = datetime.now() - timedelta(days=180)
    
    for issue in all_roots:
        if status == "closed":
            act = datetime.fromisoformat(issue.get("last_activity_at")) if issue.get("last_activity_at") else datetime.fromisoformat(issue.get("created_at"))
            # remove timezone info for comparison if it exists
            if act.tzinfo: act = act.replace(tzinfo=None)
            if act < six_months_ago:
                continue
                
        # Access control
        if role == "senior":
            accessible.append(issue)
        elif issue.get("created_by_emp_id") == emp_id:
            accessible.append(issue)
        elif issue.get("dept_id") == dept_id:
             accessible.append(issue)
        elif issue.get("assigned_dept_id") == dept_id:
             accessible.append(issue)
            
    accessible.sort(key=lambda x: x.get("last_activity_at", x.get("created_at", "")), reverse=True)
    
    # Format to match existing frontend expectations
    formatted_issues = []
    for issue in accessible[:limit]:
        formatted = dict(issue)
        formatted["issue_id"] = issue["id"]
        formatted["assigned_team"] = issue.get("assigned_dept_id")
        formatted["last_activity"] = issue.get("last_activity_at")
        formatted["type"] = "new"  # roots mapped as new
        formatted_issues.append(formatted)

    return formatted_issues


@router.get("/issues/{issue_id}/graph")
async def get_issue_graph(issue_id: str, supabase: Client = Depends(get_supabase)):
    """Returns the DAG representation for the React Flow frontend."""
    # Fetch Root
    root_res = supabase.table("issues").select("*").eq("id", issue_id).execute()
    if not root_res.data:
        raise HTTPException(status_code=404, detail="Issue not found.")
    root = root_res.data[0]
    
    # Fetch Nodes
    nodes_res = supabase.table("issue_nodes").select("*").eq("root_issue_id", issue_id).execute()
    issue_nodes = nodes_res.data
    
    nodes = []
    edges = []
    
    # Add Root Node
    nodes.append({
        "id": root["id"],
        "data": {
            "label": root.get("header"),
            "tag": "green", # Roots are green by definition
            "author": root.get("created_by_emp_id"),
            "description": root.get("description"),
            "created_at": root.get("created_at"),
            "type": "new"
        }
    })
    
    for n in issue_nodes:
        nodes.append({
            "id": n["id"],
            "data": {
                "label": n.get("header"),
                "tag": n.get("tag"),
                "author": n.get("created_by_emp_id"),
                "description": n.get("description"),
                "created_at": n.get("created_at"),
                "type": n.get("node_type")
            }
        })
        
        parent_id = n.get("parent_node_id") or n.get("root_issue_id")
        if parent_id:
            edges.append({
                "id": f"e-{parent_id}-{n['id']}",
                "source": parent_id,
                "target": n["id"]
            })
            
    return {"nodes": nodes, "edges": edges}

@router.get("/issues/{issue_id}", response_model=dict)
async def get_issue(issue_id: str, supabase: Client = Depends(get_supabase)):
    res = supabase.table("issues").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Issue not found.")
    
    issue = res.data[0]
    # Format to match frontend
    issue["issue_id"] = issue["id"]
    issue["assigned_team"] = issue.get("assigned_dept_id")
    issue["last_activity"] = issue.get("last_activity_at")

    return issue



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


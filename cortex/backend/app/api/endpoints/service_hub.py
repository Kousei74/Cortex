from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import date, datetime, timedelta
import httpx
import uuid

from app.core.config import settings
from app.core.database import get_supabase, service_role_supabase
from app.core.security import decode_access_token, oauth2_scheme
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
    assigned_teams: List[str] = Field(default_factory=list)
    priority: PRIORITY_VALUES
    description: str = Field(..., min_length=1, max_length=2000)
    created_by: str
    emp_id: Optional[str] = None
    dept_id: Optional[str] = None
    parent_ticket: Optional[str] = None
    chained_to: Optional[str] = None
    deadline: Optional[str] = None
    code_changes: Optional[str] = None
    code_language: Optional[str] = None

class ExistingIssueRequest(BaseModel):
    type: Literal["existing"] = "existing"
    parent_issue_id: str = Field(..., min_length=1)
    issue_subheader: str = Field(..., min_length=1, max_length=120)
    date: date
    description: str = Field(..., min_length=1, max_length=2000)
    additional_teams: List[str] = Field(default_factory=list)
    created_by: str
    emp_id: Optional[str] = None
    dept_id: Optional[str] = None
    layout_x: Optional[float] = None
    layout_y: Optional[float] = None
    code_changes: Optional[str] = None
    code_language: Optional[str] = None
    deadline: Optional[str] = None

class IssueInfoUpdateRequest(BaseModel):
    issue_header: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    code_changes: Optional[str] = None
    code_language: Optional[str] = None
    emp_id: Optional[str] = None
    role: Optional[str] = "team_member" 
    last_updated_at: Optional[str] = None # For Optimistic Concurrency Control

class IssueTagRequest(BaseModel):
    tag: Literal["pending", "yellow", "blue", "green", "red"]
    senior_comment: Optional[str] = None
    role: Optional[str] = "team_member" 
    last_updated_at: Optional[str] = None # For Optimistic Concurrency Control

class IssueMergeRequest(BaseModel):
    target_parent_id: str
    branch_nodes: List[str] # IDs of the blue branch nodes being merged
    metadata_summary: str
    header: Optional[str] = None
    description: Optional[str] = None
    code_changes: Optional[str] = None
    code_language: Optional[str] = None
    emp_id: Optional[str] = None
    dept_id: Optional[str] = None

class NodeConnectRequest(BaseModel):
    connected_to_id: str
    emp_id: Optional[str] = None

class NodePositionRequest(BaseModel):
    layout_x: float
    layout_y: float

class IssueResponse(BaseModel):
    issue_id: str
    type: str
    status: str
    message: str
    parent_id: Optional[str] = None

# ─── RBAC Dependencies ────────────────────────────────────────────────────────

def get_session_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    """Extracts the authenticated user data from the JWT."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Standardize the role at extract time
    raw_role = payload.get("user_role") or "team_member"
    return {
        "emp_id": payload.get("emp_id"),
        "role": str(raw_role).strip().lower()
    }

# ─── RBAC Helpers ────────────────────────────────────────────────────────────

class NodePermissions:
    @staticmethod
    def is_senior(role: Optional[str]) -> bool:
        if not role:
            return False
        return str(role).strip().lower() == "senior"

    @staticmethod
    def can_tag(session_user: Dict[str, Any]) -> None:
        role = session_user.get("role")
        if not NodePermissions.is_senior(role):
            raise HTTPException(
                status_code=403, 
                detail=f"Permission Denied: Only Seniors can tag or change node status. (Verified Role: {role})"
            )

    @staticmethod
    def can_edit_node(node: Dict[str, Any], session_user: Dict[str, Any]) -> None:
        """
        Policy: 
        - Seniors can edit any node.
        - Team members can only edit their own pending nodes.
        """
        role = session_user.get("role")
        emp_id = session_user.get("emp_id")
        
        is_senior = NodePermissions.is_senior(role)
        if is_senior:
            return

        # Authorship check
        # Prefer created_by_emp_id from DB
        author_id = node.get("created_by_emp_id") or node.get("author")
        if author_id != emp_id:
            raise HTTPException(
                status_code=403, 
                detail=f"Permission Denied: Only the author can update this node. (Author: {author_id}, You: {emp_id}, Verified Role: {role})"
            )

        # State check for team members
        if node.get("tag") != "pending":
            raise HTTPException(
                status_code=403, 
                detail=f"Permission Denied: Team members can only edit nodes in 'pending' state. (Verified Role: {role}, Tag: {node.get('tag')})"
            )

    @staticmethod
    def can_edit_root_issue(issue: Dict[str, Any], session_user: Dict[str, Any]) -> None:
        """
        Policy:
        - Seniors can edit any root issue.
        - Authors can edit their own root issues.
        """
        role = session_user.get("role")
        emp_id = session_user.get("emp_id")
        
        if NodePermissions.is_senior(role):
            return
            
        # Ensure we use the correct column name from the database
        author_id = issue.get("created_by_emp_id") or issue.get("author")
        if author_id != emp_id:
            raise HTTPException(
                status_code=403, 
                detail=f"Permission Denied: Only the author can update this node. (Author: {author_id}, You: {emp_id}, Verified Role: {role})"
            )

# ─── Issue Endpoints ─────────────────────────────────────────────────────────

@router.post("/issues", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(
    request: NewIssueRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    issue_id = f"ISS-{str(uuid.uuid4())[:8].upper()}"
    emp_id = session_user.get("emp_id")
    
    data = {
        "id": issue_id,
        "header": request.issue_header,
        "date": request.date.isoformat(),
        "description": request.description,
        "priority": request.priority,
        "status": "open",
        "created_by_emp_id": emp_id,
        "assigned_dept_ids": request.assigned_teams,
        "dept_id": request.dept_id,
        "parent_external_ticket": request.parent_ticket,
        "chained_issue_id": request.chained_to,
        "code_changes": request.code_changes,
        "code_language": request.code_language,
        "deadline": request.deadline,
        "created_at": datetime.now().isoformat(),
        "last_activity_at": datetime.now().isoformat()
    }
    
    try:
        supabase.table("issues").insert(data).execute()
        
        # Also create assignment history entry if assigned teams are provided
        if request.assigned_teams:
            for team in request.assigned_teams:
                supabase.table("issue_assignments_history").insert({
                    "issue_id": issue_id,
                    "assigned_dept_id": team,
                    "assigned_by_emp_id": emp_id,
                    "assigned_at": datetime.now().isoformat()
                }).execute()
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
        
    return IssueResponse(issue_id=issue_id, type="new", status="open", message="Issue filed successfully.")


@router.post("/issues/child", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_child_issue(
    request: ExistingIssueRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    # Use session data as source of truth for identification
    emp_id = session_user.get("emp_id")

    # Determine the root issue tracking. The frontend parent_issue_id could be a root issue OR a child node.
    # Check if parent is a root issue:
    res = supabase.table("issues").select("id, status, assigned_dept_ids").eq("id", request.parent_issue_id).execute()
    
    if res.data:
        root_id = res.data[0]["id"]
        status = res.data[0]["status"]
        current_teams = res.data[0].get("assigned_dept_ids") or []
    else:
        # Check if parent is a node instead
        node_res = supabase.table("issue_nodes").select("id, root_issue_id").eq("id", request.parent_issue_id).execute()
        if not node_res.data:
            raise HTTPException(status_code=404, detail=f"Parent issue '{request.parent_issue_id}' not found.")
        root_id = node_res.data[0]["root_issue_id"]
        
        root_res = supabase.table("issues").select("status, assigned_dept_ids").eq("id", root_id).execute()
        status = root_res.data[0]["status"] if root_res.data else "closed"
        current_teams = root_res.data[0].get("assigned_dept_ids") if root_res.data else []

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
        "parent_node_id": request.parent_issue_id if request.parent_issue_id != root_id else None,
        "header": request.issue_subheader,
        "description": request.description,
        "node_type": "update",
        "tag": "pending",
        "created_by_emp_id": emp_id,
        "dept_id": request.dept_id,
        "code_changes": request.code_changes,
        "code_language": request.code_language,
        "layout_x": request.layout_x,
        "layout_y": request.layout_y,
        "created_at": datetime.now().isoformat()
    }
    
    try:
        supabase.table("issue_nodes").insert(data).execute()
        supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", root_id).execute()
        
        # Append additional teams to root issue if provided
        if request.additional_teams:
            added_teams = set(request.additional_teams) - set(current_teams)
            if added_teams:
                new_teams = list(set(current_teams + request.additional_teams))
                supabase.table("issues").update({"assigned_dept_ids": new_teams}).eq("id", root_id).execute()
                for team in added_teams:
                    supabase.table("issue_assignments_history").insert({
                        "issue_id": root_id,
                        "assigned_dept_id": team,
                        "assigned_by_emp_id": emp_id,
                        "assigned_at": datetime.now().isoformat()
                    }).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    
    return IssueResponse(issue_id=node_id, type="existing", status="open",
                         message="Node added successfully. Awaiting Senior Review.", parent_id=request.parent_issue_id)


@router.patch("/issues/{issue_id}/tag")
async def tag_issue_node(
    issue_id: str, 
    request: IssueTagRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    if issue_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot arbitrarily tag root issue nodes. They remain source of truth.")

    # Enforcement: Only seniors can tag nodes (verified via session)
    NodePermissions.can_tag(session_user)

    try:
        res = supabase.table("issue_nodes").select("*").eq("id", issue_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Node not found.")
        node = res.data[0]
        
        # Requirement: Blue nodes MUST have a senior comment
        if request.tag == "blue" and not request.senior_comment:
            raise HTTPException(status_code=400, detail="Senior comment is mandatory for Blue status.")

        # Ruthless pruning for Red nodes at the end of Blue branches
        if request.tag == "red" and node.get("tag") == "blue":
            # System axing a blue branch - delete branch entirely
            supabase.table("issue_nodes").delete().eq("id", issue_id).execute()
            return {"message": "Blue branch rotting limb pruned successfully."}

        # ─── Optimistic Concurrency Control (OCC) Check ───
        if request.last_updated_at:
            db_updated_at = node.get("updated_at")
            # Handle potential string/isoformat mismatches by comparing as objects if possible, 
            # or simply as strings if normalized.
            if db_updated_at and request.last_updated_at != db_updated_at:
                raise HTTPException(
                    status_code=409, 
                    detail="Conflict: Node has been modified by another user. Please refresh."
                )

        update_payload = {"tag": request.tag}
        if request.senior_comment:
            update_payload["senior_comment"] = request.senior_comment

        supabase.table("issue_nodes").update(update_payload).eq("id", issue_id).execute()
        return {"message": f"Node {issue_id} tagged as {request.tag}", "node": {**node, **update_payload}}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")


@router.patch("/issues/node/{node_id}/info")
async def update_issue_node_info(
    node_id: str, 
    request: IssueInfoUpdateRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    if node_id.startswith("ISS-"):
        # For root issues
        res = supabase.table("issues").select("created_by_emp_id").eq("id", node_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Issue not found.")
        
        NodePermissions.can_edit_root_issue(res.data[0], session_user)
            
        update_data = {}
        if request.issue_header is not None: update_data["header"] = request.issue_header
        if request.description is not None: update_data["description"] = request.description
        if request.code_changes is not None: update_data["code_changes"] = request.code_changes
        if request.code_language is not None: update_data["code_language"] = request.code_language
        update_data["last_activity_at"] = datetime.now().isoformat()
        
        supabase.table("issues").update(update_data).eq("id", node_id).execute()
        return {"message": "Root issue updated successfully."}
    else:
        # For child nodes
        res = supabase.table("issue_nodes").select("*").eq("id", node_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Node not found.")
        node = res.data[0]
        
        NodePermissions.can_edit_node(node, session_user)

        # ─── Optimistic Concurrency Control (OCC) Check ───
        if request.last_updated_at:
            db_updated_at = node.get("updated_at")
            if db_updated_at and request.last_updated_at != db_updated_at:
                raise HTTPException(
                    status_code=409, 
                    detail="Conflict: Node has been modified by another user. Please refresh."
                )
            
        update_data = {}
        if request.issue_header is not None: update_data["header"] = request.issue_header
        if request.description is not None: update_data["description"] = request.description
        if request.code_changes is not None: update_data["code_changes"] = request.code_changes
        if request.code_language is not None: update_data["code_language"] = request.code_language
        
        supabase.table("issue_nodes").update(update_data).eq("id", node_id).execute()
        supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", node["root_issue_id"]).execute()
        
        return {"message": "Node info updated successfully."}


@router.patch("/issues/node/{node_id}/connect")
async def connect_issue_node(
    node_id: str, 
    request: NodeConnectRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    if node_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot connect root issues.")
        
    res = supabase.table("issue_nodes").select("*").eq("id", node_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    
    # RBAC: Only those who can edit the node can connect it
    NodePermissions.can_edit_node(res.data[0], session_user)
        
    # Verify the new connection target exists (can be an issue or a node)
    p_res = supabase.table("issues").select("id").eq("id", request.connected_to_id).execute()
    n_res = supabase.table("issue_nodes").select("id").eq("id", request.connected_to_id).execute()
    if not p_res.data and not n_res.data:
        raise HTTPException(status_code=404, detail="Connection target not found.")
        
    supabase.table("issue_nodes").update({"connected_to_id": request.connected_to_id}).eq("id", node_id).execute()
    return {"message": f"Node {node_id} successfully connected to {request.connected_to_id}."}

@router.patch("/issues/node/{node_id}/position")
async def update_issue_node_position(
    node_id: str, 
    request: NodePositionRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    if node_id.startswith("ISS-"):
        return {"message": "Root node position is fixed to (0,0)."}

    # Fetch node for RBAC
    res = supabase.table("issue_nodes").select("*").eq("id", node_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")

    NodePermissions.can_edit_node(res.data[0], session_user)
        
    supabase.table("issue_nodes").update({
        "layout_x": request.layout_x,
        "layout_y": request.layout_y
    }).eq("id", node_id).execute()
    
    return {"message": "Position successfully saved."}


@router.post("/issues/merge")
async def merge_blue_branch(
    request: IssueMergeRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    # Enforcement: Only seniors can merge branches
    NodePermissions.can_tag(session_user)

    # Verify the target parent exists and find the root
    p_res = supabase.table("issues").select("id").eq("id", request.target_parent_id).execute()
    n_res = supabase.table("issue_nodes").select("id, root_issue_id").eq("id", request.target_parent_id).execute()
    
    if p_res.data:
        root_id = request.target_parent_id
    elif n_res.data:
        root_id = n_res.data[0]["root_issue_id"]
    else:
        raise HTTPException(status_code=404, detail="Target parent not found.")
        
    try:
        # ─── ATOMIC GREEN TRAIL LOGIC ───
        
        # 1. Turn all branch nodes Green in a SINGLE DB call
        # This is more efficient and provides database-level atomicity for this specific update
        if request.branch_nodes:
            supabase.table("issue_nodes").update({
                "tag": "green",
                "senior_comment": None # Clear senior note upon merge to truth path
            }).in_("id", request.branch_nodes).execute()
                
        # 2. Turn the original Blue node (target_parent_id) Green and Update Documentation
        if not request.target_parent_id.startswith("ISS-"):
            landing_node_update = {
                "tag": "green",
                "senior_comment": None # Clear senior note upon merge to truth path
            }
            # Only update documentation if provided (Local Truth persistence)
            if request.header: landing_node_update["header"] = request.header
            if request.description: landing_node_update["description"] = request.description
            if request.code_changes: landing_node_update["code_changes"] = request.code_changes
            if request.code_language: landing_node_update["code_language"] = request.code_language
            
            supabase.table("issue_nodes").update(landing_node_update).eq("id", request.target_parent_id).execute()

        supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", root_id).execute()

    except Exception as e:
         raise HTTPException(status_code=400, detail=f"Database error during atomic merge: {str(e)}")
         
    return {"message": "Branch successfully consolidated into the Green truth path.", "status": "success"}


@router.delete("/issues/{issue_id}")
async def delete_issue_node(
    issue_id: str,
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    if issue_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot delete root issues. Close them instead.")
        
    res = service_role_supabase.table("issue_nodes").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
        
    NodePermissions.can_edit_node(node, session_user)


    service_role_supabase.table("issue_nodes").delete().eq("id", issue_id).execute()
    return {"message": "Node deleted successfully within window."}


class RestoreNodeRequest(BaseModel):
    id: str
    root_issue_id: str
    parent_node_id: Optional[str] = None
    header: Optional[str] = None
    description: Optional[str] = None
    node_type: Optional[str] = "update"
    tag: Optional[str] = "pending"
    created_by_emp_id: Optional[str] = None
    dept_id: Optional[str] = None
    code_changes: Optional[str] = None
    code_language: Optional[str] = None
    layout_x: Optional[float] = None
    layout_y: Optional[float] = None
    created_at: Optional[str] = None


@router.post("/issues/restore")
async def restore_issue_node(
    request: RestoreNodeRequest,
    session_user: Dict[str, Any] = Depends(get_session_user)
):
    """Re-inserts a previously deleted node with its original ID. Used by Ctrl+Z undo."""
    # RBAC: Only those who could edit the original node (or seniors) can restore it.
    # We use the request data since the node is already deleted from DB.
    simulated_node = request.model_dump()
    NodePermissions.can_edit_node(simulated_node, session_user)

    data = request.model_dump(exclude_none=True)
    try:
        service_role_supabase.table("issue_nodes").insert(data).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Restore failed: {str(e)}")
    return {"message": "Node restored successfully."}


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
        elif dept_id in (issue.get("assigned_dept_ids") or []):
             accessible.append(issue)
            
    accessible.sort(key=lambda x: x.get("last_activity_at", x.get("created_at", "")), reverse=True)
    
    # Format to match existing frontend expectations
    formatted_issues = []
    for issue in accessible[:limit]:
        formatted = dict(issue)
        formatted["issue_id"] = issue["id"]
        formatted["assigned_teams"] = issue.get("assigned_dept_ids") or []
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
            "code_changes": root.get("code_changes"),
            "code_language": root.get("code_language"),
            "created_at": root.get("created_at"),
            "type": "new",
            "layout_x": 0.0,
            "layout_y": 0.0
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
                "code_changes": n.get("code_changes"),
                "code_language": n.get("code_language"),
                "created_at": n.get("created_at"),
                "updated_at": n.get("updated_at"), # Silent Knight: backend sync
                "type": n.get("node_type"),
                "layout_x": n.get("layout_x"),
                "layout_y": n.get("layout_y"),
                "senior_comment": n.get("senior_comment")
            }
        })
        
        parent_id = n.get("parent_node_id") or n.get("root_issue_id")
        if parent_id:
            edges.append({
                "id": f"e-{parent_id}-{n['id']}",
                "source": parent_id,
                "target": n["id"]
            })
            
        connected_to = n.get("connected_to_id")
        if connected_to:
            edges.append({
                "id": f"e-conn-{n['id']}-{connected_to}",
                "source": n["id"],
                "target": connected_to
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
    issue["assigned_teams"] = issue.get("assigned_dept_ids") or []
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


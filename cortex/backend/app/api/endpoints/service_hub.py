from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import date, datetime, timedelta
import httpx
import uuid
from urllib.parse import urlencode, quote_plus
from jose import jwt, JWTError

from app.core.config import settings
from app.core.database import get_supabase, service_role_supabase
from app.core.security import SessionUser, get_current_user
from app.services.tree_logic import TreeLogicService
from supabase import Client

router = APIRouter()


# ─── Priority ────────────────────────────────────────────────────────────────
PRIORITY_VALUES = Literal["critical", "high", "mid", "low"]
PRIORITY_ORDER  = ["critical", "high", "mid", "low"]

def _priority_index(p: str) -> int:
    return PRIORITY_ORDER.index(p) if p in PRIORITY_ORDER else -1


def _require_user_department(session_user: SessionUser) -> str:
    dept_id = (session_user.dept_id or "").strip()
    if not dept_id:
        raise HTTPException(
            status_code=400,
            detail="Your profile is missing a department assignment. Please update your profile before using Service Hub.",
        )
    return dept_id


def _normalize_assigned_departments(primary_dept_id: Optional[str], extra_dept_ids: Optional[List[str]]) -> List[str]:
    ordered_departments: List[str] = []
    for dept_id in [primary_dept_id, *(extra_dept_ids or [])]:
        normalized = (dept_id or "").strip()
        if normalized and normalized not in ordered_departments:
            ordered_departments.append(normalized)
    return ordered_departments


def _can_access_issue(issue: Dict[str, Any], session_user: SessionUser) -> bool:
    if session_user.is_senior:
        return True

    if issue.get("created_by_emp_id") == session_user.emp_id:
        return True

    session_dept_id = (session_user.dept_id or "").strip()
    if not session_dept_id:
        return False

    if issue.get("dept_id") == session_dept_id:
        return True

    return session_dept_id in (issue.get("assigned_dept_ids") or [])


def _require_issue_access(issue: Dict[str, Any], session_user: SessionUser) -> None:
    if not _can_access_issue(issue, session_user):
        raise HTTPException(status_code=403, detail="Permission Denied: You do not have access to this issue.")


def _load_root_issue_by_parent(supabase: Client, parent_issue_id: str) -> Dict[str, Any]:
    root_res = supabase.table("issues").select("*").eq("id", parent_issue_id).execute()
    if root_res.data:
        return root_res.data[0]

    node_res = supabase.table("issue_nodes").select("root_issue_id").eq("id", parent_issue_id).execute()
    if not node_res.data:
        raise HTTPException(status_code=404, detail=f"Parent issue '{parent_issue_id}' not found.")

    root_id = node_res.data[0]["root_issue_id"]
    root_res = supabase.table("issues").select("*").eq("id", root_id).execute()
    if not root_res.data:
        raise HTTPException(status_code=404, detail="Root issue not found.")

    return root_res.data[0]


def _create_slack_oauth_state(session_user: SessionUser) -> str:
    payload = {
        "sub": session_user.email,
        "emp_id": session_user.emp_id,
        "purpose": "slack_oauth",
        "exp": datetime.utcnow() + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.SUPABASE_JWT_SECRET, algorithm="HS256")


def _decode_slack_oauth_state(state: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(state, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid Slack OAuth state.") from exc

    if payload.get("purpose") != "slack_oauth":
        raise HTTPException(status_code=401, detail="Invalid Slack OAuth state.")

    email = payload.get("sub")
    emp_id = payload.get("emp_id")
    if not email or not emp_id:
        raise HTTPException(status_code=401, detail="Invalid Slack OAuth state.")

    return payload


def _frontend_redirect_with_status(param: str, value: str) -> str:
    separator = "&" if "?" in settings.FRONTEND_URL else "?"
    return f"{settings.FRONTEND_URL}{separator}{param}={quote_plus(value)}"


def _get_slack_connection(session_user: SessionUser) -> Dict[str, Any]:
    try:
        res = service_role_supabase.table("users").select(
            "email, slack_access_token, slack_connected_at, slack_user_id, slack_team_id, slack_team_name"
        ).eq("email", session_user.email).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load Slack connection: {str(exc)}")

    if not res.data:
        raise HTTPException(status_code=404, detail="User not found.")

    return res.data[0]


def _clear_slack_connection(email: str) -> None:
    service_role_supabase.table("users").update({
        "slack_access_token": None,
        "slack_connected_at": None,
        "slack_user_id": None,
        "slack_team_id": None,
        "slack_team_name": None,
    }).eq("email", email).execute()


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
    connection_type: Optional[Literal["MAIN", "LEFT", "RIGHT"]] = "MAIN"
    code_changes: Optional[str] = None
    code_language: Optional[str] = None
    deadline: Optional[str] = None

class IssueInfoUpdateRequest(BaseModel):
    issue_header: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, min_length=1, max_length=2000)
    code_changes: Optional[str] = None
    code_language: Optional[str] = None
    priority: Optional[str] = None
    assigned_dept_ids: Optional[List[str]] = None
    deadline: Optional[str] = None
    emp_id: Optional[str] = None
    role: Optional[str] = "team_member" 
    last_updated_at: Optional[str] = None # For Optimistic Concurrency Control

class IssueTagRequest(BaseModel):
    tag: Literal["pending", "yellow", "blue", "green", "red"]
    senior_comment: Optional[str] = None
    issue_header: Optional[str] = None
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
    session_user: SessionUser = Depends(get_current_user)
):
    issue_id = f"ISS-{str(uuid.uuid4())[:8].upper()}"
    emp_id = session_user.emp_id
    creator_dept_id = _require_user_department(session_user)
    assigned_departments = _normalize_assigned_departments(creator_dept_id, request.assigned_teams)
    
    data = {
        "id": issue_id,
        "issue_id": issue_id,
        "type": request.type, # Populate type column
        "header": request.issue_header,
        "date": request.date.isoformat(),
        "description": request.description,
        "priority": request.priority,
        "status": "open",
        "created_by_emp_id": emp_id,
        "assigned_dept_ids": assigned_departments,
        "dept_id": creator_dept_id,
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
        
        if assigned_departments:
            for team in assigned_departments:
                service_role_supabase.table("issue_assignments_history").insert({
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
    session_user: SessionUser = Depends(get_current_user)
):
    # Use session data as source of truth for identification
    emp_id = session_user.emp_id
    creator_dept_id = _require_user_department(session_user)

    root_issue = _load_root_issue_by_parent(supabase, request.parent_issue_id)
    _require_issue_access(root_issue, session_user)

    root_id = root_issue["id"]
    status = root_issue["status"]
    current_teams = root_issue.get("assigned_dept_ids") or []

    if status == "closed":
        raise HTTPException(status_code=400, detail="Cannot add nodes to a closed issue.")

    # ─── Terminal Enforcement, Slot Gating, and Blue Lock ───
    if request.parent_issue_id != root_id:
        TreeLogicService.validate_node_creation(supabase, request.parent_issue_id, request.connection_type)


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
        "dept_id": creator_dept_id,
        "code_changes": request.code_changes,
        "code_language": request.code_language,
        "layout_x": request.layout_x,
        "layout_y": request.layout_y,
        "connection_type": request.connection_type,
        "created_at": datetime.now().isoformat()
    }
    
    try:
        supabase.table("issue_nodes").insert(data).execute()
        supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", root_id).execute()
        
        # Append additional teams to root issue if provided
        additional_departments = _normalize_assigned_departments(root_issue.get("dept_id") or creator_dept_id, request.additional_teams)
        added_teams = set(additional_departments) - set(current_teams)
        if added_teams:
            new_teams = _normalize_assigned_departments(root_issue.get("dept_id") or creator_dept_id, list(set(current_teams + list(added_teams))))
            supabase.table("issues").update({"assigned_dept_ids": new_teams}).eq("id", root_id).execute()
            for team in added_teams:
                service_role_supabase.table("issue_assignments_history").insert({
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
    session_user: SessionUser = Depends(get_current_user)
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

        # Ruthless pruning for Red nodes
        if request.tag == "red":
            result = TreeLogicService.execute_red_axe(supabase, issue_id)
            if result.get("action") == "truncated":
                return {"message": result.get("message")}
            # If closed_issue, we continue so the tag itself gets updated to red visually.

        # ─── Optimistic Concurrency Control (OCC) Check ───
        if request.last_updated_at:
            db_updated_at = node.get("updated_at")
            if db_updated_at and request.last_updated_at != db_updated_at:
                raise HTTPException(
                    status_code=409, 
                    detail="Conflict: Node has been modified by another user. Please refresh."
                )

        # ─── Yellow Stacking & Promotion Logic ───
        if request.tag in ["green", "blue"]:
            TreeLogicService.cleanup_yellow_siblings(
                supabase, 
                node.get("parent_node_id"), 
                node.get("root_issue_id"), 
                node.get("connection_type")
            )

        update_payload = {"tag": request.tag}
        if request.senior_comment:
            update_payload["senior_comment"] = request.senior_comment
        if request.issue_header:
            update_payload["header"] = request.issue_header

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
    session_user: SessionUser = Depends(get_current_user)
):
    if node_id.startswith("ISS-"):
        # For root issues
        res = supabase.table("issues").select("created_by_emp_id, dept_id").eq("id", node_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Issue not found.")
        
        issue = res.data[0]
        NodePermissions.can_edit_root_issue(issue, session_user)
            
        update_data = {}
        if request.issue_header is not None: update_data["header"] = request.issue_header
        if request.description is not None: update_data["description"] = request.description
        if request.code_changes is not None: update_data["code_changes"] = request.code_changes
        if request.code_language is not None: update_data["code_language"] = request.code_language
        if request.priority is not None: update_data["priority"] = request.priority
        if request.assigned_dept_ids is not None:
            primary_dept_id = issue.get("dept_id") or _require_user_department(session_user)
            update_data["dept_id"] = primary_dept_id
            update_data["assigned_dept_ids"] = _normalize_assigned_departments(primary_dept_id, request.assigned_dept_ids)
        if request.deadline is not None: update_data["deadline"] = request.deadline
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
    session_user: SessionUser = Depends(get_current_user)
):
    if node_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot connect root issues.")
        
    res = supabase.table("issue_nodes").select("*").eq("id", node_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
    
    # RBAC: Only those who can edit the node can connect it
    NodePermissions.can_edit_node(node, session_user)
        
    # Verify the new connection target exists (can be an issue or a node)
    p_res = supabase.table("issues").select("id").eq("id", request.connected_to_id).execute()
    n_res = supabase.table("issue_nodes").select("id, root_issue_id").eq("id", request.connected_to_id).execute()
    if not p_res.data and not n_res.data:
        raise HTTPException(status_code=404, detail="Connection target not found.")

    target_root_id = request.connected_to_id if p_res.data else n_res.data[0]["root_issue_id"]
    if target_root_id != node.get("root_issue_id"):
        raise HTTPException(status_code=400, detail="Nodes can only be connected within the same root issue.")
        
    supabase.table("issue_nodes").update({"connected_to_id": request.connected_to_id}).eq("id", node_id).execute()
    return {"message": f"Node {node_id} successfully connected to {request.connected_to_id}."}

@router.patch("/issues/node/{node_id}/position")
async def update_issue_node_position(
    node_id: str, 
    request: NodePositionRequest, 
    supabase: Client = Depends(get_supabase),
    session_user: SessionUser = Depends(get_current_user)
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
    session_user: SessionUser = Depends(get_current_user)
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

    if request.branch_nodes:
        unique_branch_nodes = list(dict.fromkeys(request.branch_nodes))
        branch_res = supabase.table("issue_nodes").select("id, root_issue_id").in_("id", unique_branch_nodes).execute()
        branch_nodes = branch_res.data or []
        if len(branch_nodes) != len(unique_branch_nodes):
            raise HTTPException(status_code=404, detail="One or more branch nodes were not found.")
        if any(node.get("root_issue_id") != root_id for node in branch_nodes):
            raise HTTPException(status_code=400, detail="Branch nodes must belong to the same root issue as the merge target.")
        
    try:
        # ─── Verification: Ensure Branch is Fully Resolved (No Blue Nodes downstream) ───
        if request.branch_nodes:
            # We can pick any node in the branch to find its side.
            sample_node = supabase.table("issue_nodes").select("connection_type, parent_node_id").eq("id", request.branch_nodes[0]).execute()
            if sample_node.data:
                # Find the root connection type of this branch by tracking up
                side = "LEFT" # Fallback
                for n_id in request.branch_nodes:
                    check_res = supabase.table("issue_nodes").select("connection_type, parent_node_id").eq("id", n_id).execute()
                    if check_res.data and check_res.data[0].get("parent_node_id") == request.target_parent_id:
                        side = check_res.data[0].get("connection_type")
                        break
                        
                TreeLogicService.verify_branch_resolved(supabase, request.target_parent_id, side)

        # ─── ATOMIC GREEN TRAIL LOGIC ───
        
        # 1. Turn all branch nodes Green in a SINGLE DB call
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
    last_updated_at: Optional[str] = None, # OCC Query Param
    session_user: SessionUser = Depends(get_current_user)
):
    if issue_id.startswith("ISS-"):
        raise HTTPException(status_code=400, detail="Cannot delete root issues. Close them instead.")
        
    res = service_role_supabase.table("issue_nodes").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Node not found.")
    node = res.data[0]
        
    NodePermissions.can_edit_node(node, session_user)

    # ─── Optimistic Concurrency Control (OCC) Check ───
    if last_updated_at:
        db_updated_at = node.get("updated_at")
        if db_updated_at and last_updated_at != db_updated_at:
            raise HTTPException(
                status_code=409, 
                detail="Conflict: Node has been modified by another user. Please refresh."
            )


    # ─── Verification: No Validated Children ───
    if not NodePermissions.is_senior(session_user.get("role")):
        children_res = service_role_supabase.table("issue_nodes").select("tag").eq("parent_node_id", issue_id).execute()
        if children_res.data:
            has_tagged = any(c.get("tag") in ["blue", "green", "red"] for c in children_res.data)
            if has_tagged:
                raise HTTPException(status_code=400, detail="Cannot delete node: It has verified (tagged) children.")

    service_role_supabase.table("issue_nodes").delete().eq("id", issue_id).execute()
    service_role_supabase.table("issues").update({"last_activity_at": datetime.now().isoformat()}).eq("id", node["root_issue_id"]).execute()
    return {"message": "Node deleted successfully within window."}


@router.post("/issues/{issue_id}/close")
async def close_issue(
    issue_id: str,
    supabase: Client = Depends(get_supabase),
    session_user: SessionUser = Depends(get_current_user),
):
    res = supabase.table("issues").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Root issue not found.")
    issue = res.data[0]

    NodePermissions.can_edit_root_issue(issue, session_user)
        
    # Check if any active blue branches exist under this issue
    blue_res = supabase.table("issue_nodes").select("id").eq("root_issue_id", issue_id).eq("tag", "blue").execute()
    if blue_res.data:
        raise HTTPException(status_code=400, detail="Cannot close issue while active Blue branches exist.")
        
    supabase.table("issues").update({"status": "closed", "last_activity_at": datetime.now().isoformat()}).eq("id", issue_id).execute()
    return {"message": "Issue closed successfully."}


@router.get("/issues", response_model=list)
async def list_issues(
    status: str = "open",
    limit: int = 50,
    supabase: Client = Depends(get_supabase),
    session_user: SessionUser = Depends(get_current_user),
):
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
        if _can_access_issue(issue, session_user):
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
async def get_issue_graph(
    issue_id: str,
    supabase: Client = Depends(get_supabase),
    session_user: SessionUser = Depends(get_current_user),
):
    """Returns the DAG representation for the React Flow frontend."""
    # Fetch Root
    root_res = supabase.table("issues").select("*").eq("id", issue_id).execute()
    if not root_res.data:
        raise HTTPException(status_code=404, detail="Issue not found.")
    root = root_res.data[0]
    _require_issue_access(root, session_user)
    
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
            "layout_y": 0.0,
            "priority": root.get("priority"),
            "severity": root.get("severity"),
            "primary_tag": root.get("primary_tag"),
            "deadline": root.get("deadline"),
            "assigned_dept_ids": root.get("assigned_dept_ids")
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
                "connection_type": n.get("connection_type", "MAIN"),
                "layout_locked": n.get("layout_locked", True),
                "senior_comment": n.get("senior_comment")
            }
        })
        
        parent_id = n.get("parent_node_id") or n.get("root_issue_id")
        if parent_id:
            edges.append({
                "id": f"e-{parent_id}-{n['id']}",
                "source": parent_id,
                "target": n["id"],
                "connection_type": n.get("connection_type", "MAIN")
            })
            
        connected_to = n.get("connected_to_id")
        if connected_to:
            edges.append({
                "id": f"e-conn-{n['id']}-{connected_to}",
                "source": n["id"],
                "target": connected_to,
                "connection_type": "SIDE" # Merge connections are always lateral
            })
            
    return {"nodes": nodes, "edges": edges}

@router.get("/issues/{issue_id}", response_model=dict)
async def get_issue(
    issue_id: str,
    supabase: Client = Depends(get_supabase),
    session_user: SessionUser = Depends(get_current_user),
):
    res = supabase.table("issues").select("*").eq("id", issue_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Issue not found.")
    
    issue = res.data[0]
    _require_issue_access(issue, session_user)
    # Format to match frontend
    issue["issue_id"] = issue["id"]
    issue["assigned_teams"] = issue.get("assigned_dept_ids") or []
    issue["last_activity"] = issue.get("last_activity_at")

    return issue



# ─── Slack OAuth Endpoints ────────────────────────────────────────────────────

SLACK_USER_SCOPES = ",".join([
    "channels:read",
    "channels:history",
    "groups:read",
    "groups:history",
])


@router.get("/slack/authorize")
async def slack_authorize(session_user: SessionUser = Depends(get_current_user)):
    if not settings.SLACK_CLIENT_ID or not settings.SLACK_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Slack integration is not configured.")

    state = _create_slack_oauth_state(session_user)
    query = urlencode({
        "client_id": settings.SLACK_CLIENT_ID,
        "user_scope": SLACK_USER_SCOPES,
        "redirect_uri": settings.SLACK_REDIRECT_URI,
        "state": state,
    })
    authorize_url = f"https://slack.com/oauth/v2/authorize?{query}"
    return {"authorize_url": authorize_url}


@router.get("/slack/callback")
async def slack_callback(code: str = None, state: str = None, error: str = None):
    if error or not code or not state:
        return RedirectResponse(_frontend_redirect_with_status("slack_error", error or "oauth_failed"))

    try:
        state_payload = _decode_slack_oauth_state(state)
    except HTTPException:
        return RedirectResponse(_frontend_redirect_with_status("slack_error", "invalid_state"))

    async with httpx.AsyncClient() as client:
        resp = await client.post("https://slack.com/api/oauth.v2.access", data={
            "client_id": settings.SLACK_CLIENT_ID,
            "client_secret": settings.SLACK_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.SLACK_REDIRECT_URI,
        })

    data = resp.json()
    if not data.get("ok"):
        return RedirectResponse(_frontend_redirect_with_status("slack_error", data.get("error", "oauth_failed")))

    user_token = data.get("authed_user", {}).get("access_token")
    if not user_token:
        return RedirectResponse(_frontend_redirect_with_status("slack_error", "missing_user_token"))

    update_payload = {
        "slack_access_token": user_token,
        "slack_connected_at": datetime.now().isoformat(),
        "slack_user_id": data.get("authed_user", {}).get("id"),
        "slack_team_id": (data.get("team") or {}).get("id"),
        "slack_team_name": (data.get("team") or {}).get("name"),
    }

    try:
        service_role_supabase.table("users").update(update_payload).eq("email", state_payload["sub"]).execute()
    except Exception:
        return RedirectResponse(_frontend_redirect_with_status("slack_error", "persistence_failed"))

    return RedirectResponse(_frontend_redirect_with_status("slack", "connected"))


@router.get("/slack/status")
async def slack_status(session_user: SessionUser = Depends(get_current_user)):
    connection = _get_slack_connection(session_user)
    return {
        "connected": bool(connection.get("slack_access_token")),
        "connected_at": connection.get("slack_connected_at"),
        "team_id": connection.get("slack_team_id"),
        "team_name": connection.get("slack_team_name"),
        "user_id": connection.get("slack_user_id"),
    }


@router.post("/slack/disconnect")
async def slack_disconnect(session_user: SessionUser = Depends(get_current_user)):
    try:
        _clear_slack_connection(session_user.email)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to disconnect Slack: {str(exc)}")
    return {"message": "Slack disconnected successfully."}


@router.get("/slack/messages")
async def slack_messages(
    oldest: float = 0.0,
    limit: int = 10,
    session_user: SessionUser = Depends(get_current_user),
):
    connection = _get_slack_connection(session_user)
    token = connection.get("slack_access_token")
    if not token:
        raise HTTPException(status_code=404, detail="Slack is not connected for this account.")

    safe_limit = max(1, min(limit, 25))
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        ch_resp = await client.get("https://slack.com/api/users.conversations", headers=headers, params={
            "types": "public_channel,private_channel",
            "limit": 20,
        })
        ch_data = ch_resp.json()
        if not ch_data.get("ok"):
            error_code = ch_data.get("error", "slack_unavailable")
            if error_code in {"invalid_auth", "token_revoked", "not_authed", "account_inactive"}:
                _clear_slack_connection(session_user.email)
                raise HTTPException(status_code=409, detail="Slack session expired. Please reconnect.")
            raise HTTPException(status_code=502, detail=f"Slack error: {error_code}")

        channels = ch_data.get("channels", [])
        messages = []
        for ch in channels[:5]:
            msg_resp = await client.get("https://slack.com/api/conversations.history", headers=headers, params={
                "channel": ch["id"],
                "oldest": str(oldest) if oldest else "0",
                "limit": 20,
            })
            msg_data = msg_resp.json()
            if not msg_data.get("ok"):
                error_code = msg_data.get("error", "conversation_history_failed")
                if error_code in {"invalid_auth", "token_revoked", "not_authed", "account_inactive"}:
                    _clear_slack_connection(session_user.email)
                    raise HTTPException(status_code=409, detail="Slack session expired. Please reconnect.")
                continue

            for message in msg_data.get("messages", []):
                if message.get("type") == "message" and not message.get("subtype"):
                    messages.append({
                        "channel": ch.get("name", ch["id"]),
                        "user": message.get("user", ""),
                        "text": message.get("text", ""),
                        "ts": float(message.get("ts", 0)),
                    })

    messages.sort(key=lambda item: item["ts"])
    return messages[-safe_limit:]


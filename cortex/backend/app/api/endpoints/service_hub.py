from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date
import httpx
import uuid

from app.core.config import settings

router = APIRouter()

# ─── In-Memory Store (Phase 1 stub) ─────────────────────────────────────────
issues_db: dict = {}

# ─── Priority ────────────────────────────────────────────────────────────────
PRIORITY_VALUES = Literal["critical", "high", "mid", "low"]
PRIORITY_ORDER  = ["critical", "high", "mid", "low"]

def _priority_index(p: str) -> int:
    return PRIORITY_ORDER.index(p) if p in PRIORITY_ORDER else -1


# ─── Issue Schemas ────────────────────────────────────────────────────────────

class NewIssueRequest(BaseModel):
    type: Literal["new"]
    issue_header: str = Field(..., min_length=1, max_length=120)
    date: date
    dept_id:     Optional[str] = None
    emp_id:      Optional[str] = None
    priority:    PRIORITY_VALUES
    description: str = Field(..., min_length=1, max_length=500)
    created_by:  Optional[str] = None


class ExistingIssueRequest(BaseModel):
    type: Literal["existing"]
    parent_issue_id:  str = Field(..., min_length=1)
    issue_subheader:  str = Field(..., min_length=1, max_length=120)
    date:             date
    priority:         PRIORITY_VALUES
    dept_id:          Optional[str] = None
    description:      str = Field(..., min_length=1, max_length=500)
    created_by:       Optional[str] = None


class IssueResponse(BaseModel):
    issue_id:   str
    type:       str
    status:     str
    message:    str
    parent_id:  Optional[str] = None


# ─── Issue Endpoints ─────────────────────────────────────────────────────────

@router.post("/issues", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_issue(request: NewIssueRequest):
    issue_id = f"ISS-{str(uuid.uuid4())[:8].upper()}"
    issues_db[issue_id] = {
        "issue_id":    issue_id,
        "type":        "new",
        "header":      request.issue_header,
        "date":        str(request.date),
        "dept_id":     request.dept_id,
        "emp_id":      request.emp_id,
        "priority":    request.priority,
        "description": request.description,
        "created_by":  request.created_by,
        "children":    [],
        "status":      "open",
    }
    return IssueResponse(issue_id=issue_id, type="new", status="open", message="Issue filed successfully.")


@router.post("/issues/child", response_model=IssueResponse, status_code=status.HTTP_201_CREATED)
async def create_child_issue(request: ExistingIssueRequest):
    parent = issues_db.get(request.parent_issue_id)
    if not parent:
        raise HTTPException(status_code=404, detail=f"Parent issue '{request.parent_issue_id}' not found.")

    parent_idx = _priority_index(parent["priority"])
    child_idx  = _priority_index(request.priority)
    if child_idx > parent_idx:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Child priority '{request.priority}' is less urgent than parent '{parent['priority']}'."
        )

    issue_id = f"ISS-{str(uuid.uuid4())[:8].upper()}"
    issues_db[issue_id] = {
        "issue_id":    issue_id,
        "type":        "existing",
        "parent_id":   request.parent_issue_id,
        "subheader":   request.issue_subheader,
        "date":        str(request.date),
        "priority":    request.priority,
        "dept_id":     request.dept_id,
        "description": request.description,
        "created_by":  request.created_by,
        "status":      "open",
    }
    parent.setdefault("children", []).append(issue_id)
    return IssueResponse(issue_id=issue_id, type="existing", status="open",
                         message="Child issue linked successfully.", parent_id=request.parent_issue_id)


@router.get("/issues", response_model=list)
async def list_issues(limit: int = 10):
    """Returns issues sorted by date descending, max `limit` items."""
    all_issues = list(issues_db.values())
    all_issues.sort(key=lambda x: x.get("date", ""), reverse=True)
    return all_issues[:limit]


@router.get("/issues/{issue_id}", response_model=dict)
async def get_issue(issue_id: str):
    issue = issues_db.get(issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found.")
    return issue


# ─── Slack OAuth Endpoints ────────────────────────────────────────────────────

# Slack scopes needed: channels:history channels:read users:read
SLACK_SCOPES = "channels:history,channels:read,users:read"

@router.get("/slack/authorize")
async def slack_authorize():
    """Redirect the user to Slack's OAuth consent page."""
    if not settings.SLACK_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Slack integration is not configured. Set SLACK_CLIENT_ID in .env")
    url = (
        "https://slack.com/oauth/v2/authorize"
        f"?client_id={settings.SLACK_CLIENT_ID}"
        f"&scope={SLACK_SCOPES}"
        f"&redirect_uri={settings.SLACK_REDIRECT_URI}"
    )
    return RedirectResponse(url=url)


@router.get("/slack/callback")
async def slack_callback(code: str = None, error: str = None):
    """Slack redirects here after user authorizes. Exchange code for token."""
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

    # We use authed_user token for reading user's channels
    token = data.get("authed_user", {}).get("access_token") or data.get("access_token", "")
    return RedirectResponse(f"{settings.FRONTEND_URL}?slack_token={token}")


@router.get("/slack/messages")
async def slack_messages(token: str, oldest: float = 0.0, limit: int = 10):
    """
    Fetch messages from the user's most recently active channels
    that are newer than `oldest` (Unix timestamp).
    Returns a flat FIFO list, max `limit` items.
    """
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient() as client:
        # Step 1: Get channels the user is a member of
        ch_resp = await client.get("https://slack.com/api/users.conversations", headers=headers, params={
            "types": "public_channel,private_channel",
            "limit": 20,
        })
        ch_data = ch_resp.json()
        if not ch_data.get("ok"):
            raise HTTPException(status_code=401, detail=f"Slack error: {ch_data.get('error')}")

        channels = ch_data.get("channels", [])
        messages = []

        # Step 2: Fetch recent messages from each channel
        for ch in channels[:5]:  # scan top 5 channels
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

    # Sort FIFO (oldest first) and cap at limit
    messages.sort(key=lambda x: x["ts"])
    return messages[-limit:]  # keep only the most recent `limit` in FIFO order

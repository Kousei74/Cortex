from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token, get_password_hash, verify_password, SessionUser, get_current_user
from app.core.database import service_role_supabase as supabase
from app.services.auth_ops import (
    get_invite_by_token,
    get_request_by_email,
    get_user_by_email,
    normalize_email,
    normalize_name,
    run_auth_cleanup,
)
from typing import Optional
from datetime import timedelta, datetime, timezone
import time

router = APIRouter()

# --- Rate Limiter ---
auth_rate_limits = {}

def rate_limit_auth(request: Request):
    client_ip = request.headers.get("X-Forwarded-For")
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"
    else:
        client_ip = client_ip.split(",")[0].strip()
        
    now = time.time()
    if client_ip not in auth_rate_limits:
        auth_rate_limits[client_ip] = []
    
    auth_rate_limits[client_ip] = [t for t in auth_rate_limits[client_ip] if now - t < 60]
    
    if len(auth_rate_limits[client_ip]) >= 5:
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")
        
    auth_rate_limits[client_ip].append(now)

# --- Schemas ---
class AccessRequestSubmit(BaseModel):
    full_name: str
    email: EmailStr

class InviteCompleteSubmit(BaseModel):
    token: str
    full_name: str
    password: str

class InviteVerifyResponse(BaseModel):
    email: EmailStr
    full_name: str
    dept_id: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    dept_id: Optional[str] = None

class UserResponse(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    emp_id: Optional[str] = None
    dept_id: Optional[str] = None
    role: Optional[str] = "team_member"
    avatar_url: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Endpoints ---

@router.post("/request-access")
def request_access(data: AccessRequestSubmit, request: Request, _ = Depends(rate_limit_auth)):
    run_auth_cleanup()

    email = normalize_email(data.email)
    full_name = normalize_name(data.full_name)
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    try:
        if get_user_by_email(email):
            return {"message": "Request received"}

        existing_request = get_request_by_email(email)
        if existing_request and existing_request.get("status") in ["pending", "approved"]:
            return {"message": "Request received"}

        new_req = {
            "email": email,
            "full_name": full_name,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewed_by": None,
        }
        supabase.table("access_requests").upsert(new_req, on_conflict="email").execute()
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Request failed: {str(e)}")
        
    return {"message": "Request received"}

@router.get("/invite/verify", response_model=InviteVerifyResponse)
def verify_invite(token: str, request: Request, _ = Depends(rate_limit_auth)):
    run_auth_cleanup()
    invite = get_invite_by_token(token)
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid token")

    try:
        req_res = supabase.table("access_requests").select("full_name").eq("id", invite["request_id"]).execute()
        request_row = req_res.data[0] if req_res.data else None
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    if not request_row:
        raise HTTPException(status_code=400, detail="Invalid token")

    return InviteVerifyResponse(
        email=invite["email"],
        full_name=request_row.get("full_name") or "",
        dept_id=invite["approved_dept_id"]
    )

@router.post("/invite/complete")
def complete_invite(data: InviteCompleteSubmit, request: Request, _ = Depends(rate_limit_auth)):
    run_auth_cleanup()
    invite = get_invite_by_token(data.token)
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid token")

    submitted_name = normalize_name(data.full_name)
    if not submitted_name:
        raise HTTPException(status_code=400, detail="Full name is required")

    request_res = supabase.table("access_requests").select("*").eq("id", invite["request_id"]).execute()
    request_row = request_res.data[0] if request_res.data else None
    if not request_row:
        raise HTTPException(status_code=400, detail="Invalid token")

    res_user = supabase.table("users").select("email").eq("email", normalize_email(invite["email"])).execute()
    if res_user.data:
        raise HTTPException(status_code=400, detail="User already registered")

    hashed_pw = get_password_hash(data.password)
    new_user = {
        "email": normalize_email(invite["email"]),
        "hashed_password": hashed_pw,
        "full_name": submitted_name or request_row.get("full_name"),
        "dept_id": invite["approved_dept_id"],
        "role": "team_member",
        "is_approved": True
    }
    
    try:
        supabase.table("users").insert(new_user).execute()
        if invite.get("id"):
            supabase.table("invite_tokens").delete().eq("id", invite["id"]).execute()
        supabase.table("access_requests").delete().eq("id", request_row["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")
        
    return {"message": "Account created"}

@router.post("/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), _ = Depends(rate_limit_auth)):
    # OAuth2PasswordRequestForm expects 'username' and 'password'
    # We map 'username' to 'email'
    try:
        email = normalize_email(form_data.username)
        res = supabase.table("users").select("*").eq("email", email).execute()
        user = res.data[0] if res.data else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.get("is_approved", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending administrator approval. Please reach out to an admin.",
        )
    
    access_token_expires = timedelta(minutes=300) # Long expiration for dev
    access_token = create_access_token(
        data={
            "sub": user["email"],
            "aud": "authenticated", # Required by most standard Supabase configurations
            "role": "authenticated", # Tells Supabase PostgREST to assume 'authenticated' role
            "emp_id": user.get("emp_id"),
            "dept_id": user.get("dept_id"),
            "user_role": user.get("role")
        },
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(session_user: SessionUser = Depends(get_current_user)):
    email = session_user.email
    try:
        res = supabase.table("users").select("*").eq("email", email).execute()
        user = res.data[0] if res.data else None
    except Exception:
        raise HTTPException(status_code=500, detail="Database connection failed")
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    return UserResponse(
        email=user["email"], 
        full_name=user.get("full_name"),
        emp_id=user.get("emp_id"),
        dept_id=user.get("dept_id"),
        role=user.get("role"),
        avatar_url=user.get("avatar_url") if "avatar_url" in user else None
    )

@router.put("/profile", response_model=UserResponse)
def update_profile(update_data: UserUpdate, session_user: SessionUser = Depends(get_current_user)):
    email = session_user.email
    update_dict = {k: v for k, v in update_data.dict(exclude_unset=True).items() if v is not None}
    
    if update_dict:
        try:
            supabase.table("users").update(update_dict).eq("email", email).execute()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Update failed: {str(e)}")
            
    try:
        res = supabase.table("users").select("*").eq("email", email).execute()
        user = res.data[0]
    except Exception:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    return UserResponse(
        email=user["email"], 
        full_name=user.get("full_name"),
        emp_id=user.get("emp_id"),
        dept_id=user.get("dept_id"),
        role=user.get("role"),
        avatar_url=user.get("avatar_url") if "avatar_url" in user else None
    )

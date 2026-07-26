from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token, get_password_hash, verify_password, SessionUser, get_current_user
from app.core.database import service_role_supabase as supabase
from app.services.auth_ops import (
    get_invite_by_token,
    get_request_by_email,
    get_user_by_email,
    has_active_invite,
    normalize_email,
    normalize_name,
    run_auth_cleanup,
)
from typing import Optional
from datetime import timedelta, datetime, timezone
import time
from app.core.observability import get_logger, instrument_fastapi_router, instrument_module_functions, log_step

router = APIRouter()
logger = get_logger(__name__)

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
        log_step(logger, "auth.rate_limit_exceeded", client_ip=client_ip)
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
    log_step(logger, "auth.request_access.begin", email=normalize_email(data.email))
    run_auth_cleanup()
    log_step(logger, "auth.request_access.cleanup_complete")

    email = normalize_email(data.email)
    full_name = normalize_name(data.full_name)
    if not full_name:
        log_step(logger, "auth.request_access.invalid_name", email=email)
        raise HTTPException(status_code=400, detail="Full name is required")

    try:
        if get_user_by_email(email):
            log_step(logger, "auth.request_access.existing_user", email=email)
            return {"message": "Request received"}

        existing_request = get_request_by_email(email)
        if existing_request:
            req_status = existing_request.get("status")
            if req_status == "pending":
                log_step(logger, "auth.request_access.existing_pending", email=email)
                return {"message": "Request received"}
            elif req_status == "approved":
                if has_active_invite(existing_request.get("id")):
                    log_step(logger, "auth.request_access.existing_active_approved", email=email)
                    return {"message": "Request received"}
                else:
                    log_step(logger, "auth.request_access.expired_approved_reset", email=email)
                    supabase.table("access_requests").update({
                        "status": "expired",
                        "reviewed_at": datetime.now(timezone.utc).isoformat()
                    }).eq("id", existing_request["id"]).execute()

        new_req = {
            "email": email,
            "full_name": full_name,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewed_by": None,
        }
        if existing_request and existing_request.get("id"):
            new_req["id"] = existing_request["id"]

        supabase.table("access_requests").upsert(new_req, on_conflict="email").execute()
        log_step(logger, "auth.request_access.upserted", email=email, status="pending")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Request failed: {str(e)}")
        
    return {"message": "Request received"}

@router.get("/invite/verify", response_model=InviteVerifyResponse)
def verify_invite(token: str, request: Request, _ = Depends(rate_limit_auth)):
    log_step(logger, "auth.verify_invite.begin")
    run_auth_cleanup()
    invite = get_invite_by_token(token)
    if not invite:
        log_step(logger, "auth.verify_invite.invalid_token")
        raise HTTPException(status_code=400, detail="Invite token has expired (valid for 60 minutes). Please request a new access link.")

    try:
        req_res = supabase.table("access_requests").select("full_name,status").eq("id", invite["request_id"]).execute()
        request_row = req_res.data[0] if req_res.data else None
    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    if not request_row or request_row.get("status") != "approved":
        log_step(
            logger,
            "auth.verify_invite.request_not_approved",
            request_id=invite.get("request_id"),
            status=request_row.get("status") if request_row else None,
        )
        raise HTTPException(status_code=400, detail="Invalid token")

    log_step(logger, "auth.verify_invite.success", email=invite["email"], dept_id=invite["approved_dept_id"])
    return InviteVerifyResponse(
        email=invite["email"],
        full_name=request_row.get("full_name") or "",
        dept_id=invite["approved_dept_id"]
    )

@router.post("/invite/complete")
def complete_invite(data: InviteCompleteSubmit, request: Request, _ = Depends(rate_limit_auth)):
    log_step(logger, "auth.complete_invite.begin")
    run_auth_cleanup()
    invite = get_invite_by_token(data.token)
    if not invite:
        log_step(logger, "auth.complete_invite.invalid_token")
        raise HTTPException(status_code=400, detail="Invalid token")

    submitted_name = normalize_name(data.full_name)
    if not submitted_name:
        log_step(logger, "auth.complete_invite.invalid_name", email=invite.get("email"))
        raise HTTPException(status_code=400, detail="Full name is required")

    request_res = supabase.table("access_requests").select("*").eq("id", invite["request_id"]).execute()
    request_row = request_res.data[0] if request_res.data else None
    if not request_row or request_row.get("status") != "approved":
        log_step(
            logger,
            "auth.complete_invite.request_not_approved",
            request_id=invite.get("request_id"),
            status=request_row.get("status") if request_row else None,
        )
        raise HTTPException(status_code=400, detail="Invalid token")

    res_user = supabase.table("users").select("email").eq("email", normalize_email(invite["email"])).execute()
    if res_user.data:
        log_step(logger, "auth.complete_invite.user_exists", email=invite["email"])
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
        log_step(logger, "auth.complete_invite.user_insert", email=new_user["email"], dept_id=new_user["dept_id"])
        supabase.table("users").insert(new_user).execute()
        if invite.get("id"):
            log_step(logger, "auth.complete_invite.delete_invite", invite_id=invite["id"])
            supabase.table("invite_tokens").delete().eq("id", invite["id"]).execute()
        log_step(logger, "auth.complete_invite.delete_request", request_id=request_row["id"])
        supabase.table("access_requests").delete().eq("id", request_row["id"]).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")

    log_step(logger, "auth.complete_invite.success", email=new_user["email"])
    return {"message": "Account created"}

@router.post("/login", response_model=Token)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), _ = Depends(rate_limit_auth)):
    # OAuth2PasswordRequestForm expects 'username' and 'password'
    # We map 'username' to 'email'
    try:
        email = normalize_email(form_data.username)
        log_step(logger, "auth.login.lookup", email=email)
        res = supabase.table("users").select("*").eq("email", email).execute()
        user = res.data[0] if res.data else None
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        log_step(logger, "auth.login.invalid_credentials", email=email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.get("is_approved", False):
        log_step(logger, "auth.login.unapproved", email=email)
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

    log_step(logger, "auth.login.success", email=email, emp_id=user.get("emp_id"), role=user.get("role"))
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(session_user: SessionUser = Depends(get_current_user)):
    email = session_user.email
    log_step(logger, "auth.me.lookup", email=email)
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
    log_step(logger, "auth.profile.begin", email=email, fields=",".join(sorted(update_dict.keys())))
    
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


instrument_module_functions(globals(), logger, exclude_names={"instrument_module_functions", "instrument_fastapi_router"})
instrument_fastapi_router(router, logger)

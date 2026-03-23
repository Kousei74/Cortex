from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token, get_password_hash, verify_password, SessionUser, get_current_user
from app.core.database import service_role_supabase as supabase
from typing import Optional, Literal
from datetime import timedelta

router = APIRouter()

# --- Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    dept_id: Optional[str] = None
    role: Optional[Literal["senior", "team_member"]] = "team_member"

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

@router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate):
    # Check if user exists (by email)
    try:
        res_email = supabase.table("users").select("email").eq("email", user.email).execute()
        if res_email.data:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    
    hashed_pw = get_password_hash(user.password)
    new_user = {
        "email": user.email,
        "hashed_password": hashed_pw,
        "full_name": user.full_name,
        "dept_id": user.dept_id,
        "role": user.role
    }
    
    try:
        supabase.table("users").insert(new_user).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")
    
    # Fetch the generated user to return the new emp_id
    try:
        res = supabase.table("users").select("emp_id").eq("email", user.email).execute()
        generated_emp_id = res.data[0]["emp_id"] if res.data else None
    except Exception:
        generated_emp_id = None

    return UserResponse(
        email=user.email, 
        full_name=user.full_name, 
        emp_id=generated_emp_id, 
        dept_id=user.dept_id, 
        role=user.role
    )

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # OAuth2PasswordRequestForm expects 'username' and 'password'
    # We map 'username' to 'email'
    try:
        res = supabase.table("users").select("*").eq("email", form_data.username).execute()
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

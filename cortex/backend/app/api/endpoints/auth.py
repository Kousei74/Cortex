from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token, get_password_hash, verify_password, oauth2_scheme, decode_access_token
from app.core.database import supabase
from typing import Dict, Optional
from datetime import timedelta

router = APIRouter()

# --- Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserResponse(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

# --- Endpoints ---

@router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate):
    # Check if user exists
    try:
        res = supabase.table("users").select("email").eq("email", user.email).execute()
        if res.data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    except Exception as e:
        # If detail is already set (HTTPException), re-raise
        if isinstance(e, HTTPException):
            raise e
        # Otherwise typically connection error or bad request
        raise HTTPException(status_code=400, detail=f"Database error: {str(e)}")
    
    hashed_pw = get_password_hash(user.password)
    new_user = {
        "email": user.email,
        "hashed_password": hashed_pw,
        "full_name": user.full_name
    }
    
    try:
        supabase.table("users").insert(new_user).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Signup failed: {str(e)}")
    
    return UserResponse(email=user.email, full_name=user.full_name)

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
    
    access_token_expires = timedelta(minutes=300) # Long expiration for dev
    access_token = create_access_token(
        data={"sub": user["email"]},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    email = payload.get("sub")
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
        
    return UserResponse(email=user["email"], full_name=user.get("full_name"))

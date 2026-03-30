from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings

# SECRET KEY - In production, this should be in .env
# We use the Supabase JWT Secret to ensure PostgREST accepts our tokens for RLS
SECRET_KEY = settings.SUPABASE_JWT_SECRET or settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 300

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


class SessionUser(BaseModel):
    email: str
    emp_id: str
    dept_id: Optional[str] = None
    role: str = "team_member"

    # Lightweight compatibility layer so existing `.get(...)` call sites can
    # move to the shared session model without a risky all-at-once rewrite.
    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default)

    @property
    def is_senior(self) -> bool:
        return self.role == "senior"

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str):
    try:
        # We must explicitly validate the audience since we added 'aud': 'authenticated'
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience="authenticated")
        return payload
    except JWTError:
        return None


def get_current_user(token: str = Depends(oauth2_scheme)) -> SessionUser:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = payload.get("sub")
    emp_id = payload.get("emp_id")
    if not email or not emp_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    raw_role = payload.get("user_role") or "team_member"
    return SessionUser(
        email=email,
        emp_id=emp_id,
        dept_id=payload.get("dept_id"),
        role=str(raw_role).strip().lower(),
    )


def require_senior(user: SessionUser = Depends(get_current_user)) -> SessionUser:
    if not user.is_senior:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Senior access required.",
        )
    return user

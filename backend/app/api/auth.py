# backend/app/api/auth.py
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from pathlib import Path
from dotenv import load_dotenv

import bcrypt
from jose import JWTError, jwt
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, Budget
from backend.app.schemas import UserCreate, UserLogin, UserOut, UserUpdate, AuthResponse

load_dotenv(Path(__file__).resolve().parents[3] / ".env")

SECRET_KEY = os.getenv("SECRET_KEY", "finsight-iq-super-secret-key-2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))  # default 30 days

router = APIRouter()
security = HTTPBearer(auto_error=False)


# ── Password Utilities ────────────────────────────────────────────────────────
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8") if isinstance(hashed_password, str) else hashed_password,
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


# ── JWT Token Utilities ───────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── Current User Dependency ───────────────────────────────────────────────────
def get_current_user(
    auth_header: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or token expired",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not auth_header:
        raise credentials_exception

    token = auth_header
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


# ── Optional Current User (for public/fallback routes) ────────────────────────
def get_optional_current_user(
    auth_header: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not auth_header:
        return None
    try:
        return get_current_user(auth_header=auth_header, db=db)
    except HTTPException:
        return None


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/register", response_model=AuthResponse, status_code=201)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user_data.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists"
        )

    hashed_pw = get_password_hash(user_data.password)
    new_user = User(
        name=user_data.name.strip(),
        email=user_data.email.strip().lower(),
        password=hashed_pw,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Seed default starter budgets for the newly registered user
    now = datetime.now()
    default_budgets = [
        ("Food & Dining", 5000),
        ("Travel", 3000),
        ("Shopping", 4000),
        ("Bills", 6000),
        ("Entertainment", 2500),
        ("Healthcare", 2000),
    ]
    for cat, amt in default_budgets:
        b = Budget(
            user_id=new_user.id,
            category=cat,
            amount=amt,
            month=now.month,
            year=now.year,
        )
        db.add(b)
    db.commit()

    token = create_access_token(data={"sub": str(new_user.id), "email": new_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": new_user
    }


@router.post("/login", response_model=AuthResponse)
def login(data: UserLogin, db: Session = Depends(get_db)):
    email_clean = data.email.strip().lower()
    db_user = db.query(User).filter(User.email == email_clean).first()
    if not db_user or not verify_password(data.password, db_user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please check your credentials."
        )

    token = create_access_token(data={"sub": str(db_user.id), "email": db_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": db_user
    }


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if data.name is not None and data.name.strip():
        current_user.name = data.name.strip()
    if data.email is not None and data.email.strip():
        email_clean = data.email.strip().lower()
        if email_clean != current_user.email:
            existing = db.query(User).filter(User.email == email_clean).first()
            if existing:
                raise HTTPException(status_code=400, detail="Email is already taken")
            current_user.email = email_clean
    if data.password is not None and len(data.password) >= 6:
        current_user.password = get_password_hash(data.password)

    db.commit()
    db.refresh(current_user)
    return current_user

# backend/app/schemas.py
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Literal, List
from datetime import date, datetime
from decimal import Decimal


# ── User & Auth Schemas ──────────────────────────
class UserCreate(BaseModel):
    name:     str      = Field(..., min_length=2, max_length=120)
    email:    EmailStr
    password: str      = Field(..., min_length=6)


class UserLogin(BaseModel):
    email:    EmailStr
    password: str


class UserOut(BaseModel):
    id:         int
    name:       str
    email:      EmailStr
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name:     Optional[str]      = Field(None, min_length=2, max_length=120)
    email:    Optional[EmailStr] = None
    password: Optional[str]      = Field(None, min_length=6)


class AuthResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut


# ── Transaction Schemas ──────────────────────────
class TransactionCreate(BaseModel):
    type:         Literal['income', 'expense']
    category:     str     = Field(..., max_length=80)
    payment_mode: str     = Field("Cash", max_length=60)
    description:  str     = Field("", max_length=255)
    amount:       Decimal = Field(..., gt=0)
    date:         date
    source:       Literal['ui', 'iot', 'import'] = 'ui'

    class Config:
        json_schema_extra = {
            "example": {
                "type": "expense",
                "category": "Food & Dining",
                "payment_mode": "UPI",
                "description": "Lunch at office",
                "amount": 350,
                "date": "2026-09-28",
                "source": "ui"
            }
        }


class TransactionUpdate(BaseModel):
    type:         Optional[Literal['income', 'expense']] = None
    category:     Optional[str]     = Field(None, max_length=80)
    payment_mode: Optional[str]     = Field(None, max_length=60)
    description:  Optional[str]     = Field(None, max_length=255)
    amount:       Optional[Decimal] = Field(None, gt=0)
    date:         Optional[date]    = None


class TransactionOut(BaseModel):
    id:           int
    user_id:      Optional[int] = None
    type:         str
    category:     str
    payment_mode: str
    description:  str
    amount:       Decimal
    date:         date
    source:       str
    created_at:   Optional[datetime] = None

    class Config:
        from_attributes = True


class TransactionBatchCreate(BaseModel):
    transactions: List[TransactionCreate]


# ── Budget Schemas ────────────────────────────────
class BudgetCreate(BaseModel):
    category: str     = Field(..., max_length=80)
    amount:   Decimal = Field(..., gt=0)
    month:    int     = Field(..., ge=1, le=12)
    year:     int     = Field(..., ge=2020, le=2099)


class BudgetUpdate(BaseModel):
    category: Optional[str]     = Field(None, max_length=80)
    amount:   Optional[Decimal] = Field(None, gt=0)
    month:    Optional[int]     = Field(None, ge=1, le=12)
    year:     Optional[int]     = Field(None, ge=2020, le=2099)


class BudgetOut(BaseModel):
    id:       int
    user_id:  Optional[int] = None
    category: str
    amount:   Decimal
    spent:    Decimal       = Decimal('0.00')
    month:    int
    year:     int

    class Config:
        from_attributes = True


# ── IoT Device Schemas ────────────────────────────
class IoTTransactionIn(BaseModel):
    """Payload sent by IoT device / terminal"""
    device_id:    str
    api_key:      str
    type:         Literal['income', 'expense']
    category:     str
    amount:       Decimal = Field(..., gt=0)
    date:         date
    description:  str = ""
    payment_mode: str = "IoT Terminal"


# ── Anomaly Schemas ───────────────────────────────
class AnomalyReviewUpdate(BaseModel):
    status: Literal['verified', 'flagged']


class AnomalySimulateRequest(BaseModel):
    category:    Optional[str]     = "Shopping"
    amount:      Optional[Decimal] = Decimal("18500.00")
    description: Optional[str]     = "High-Value Spike Simulator"

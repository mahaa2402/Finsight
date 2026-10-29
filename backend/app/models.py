# backend/app/models.py
from sqlalchemy import Column, Integer, String, DECIMAL, Date, DateTime, Enum, SmallInteger, func
from backend.app.database import Base
import enum


class TxType(str, enum.Enum):
    income = "income"
    expense = "expense"


class TxSource(str, enum.Enum):
    ui = "ui"
    iot = "iot"
    imp = "import"


class User(Base):
    __tablename__ = "users"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(120), nullable=False)
    email      = Column(String(200), unique=True, nullable=False, index=True)
    password   = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, nullable=True)
    type         = Column(Enum("income", "expense"), nullable=False)
    category     = Column(String(80), nullable=False)
    payment_mode = Column(String(60), nullable=False, default="Cash")
    description  = Column(String(255), nullable=False, default="")
    amount       = Column(DECIMAL(12, 2), nullable=False)
    date         = Column(Date, nullable=False)
    source       = Column(Enum("ui", "iot", "import"), nullable=False, default="ui")
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())


class Budget(Base):
    __tablename__ = "budgets"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, nullable=True)
    category   = Column(String(80), nullable=False)
    amount     = Column(DECIMAL(12, 2), nullable=False)
    month      = Column(SmallInteger, nullable=False)
    year       = Column(SmallInteger, nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class IoTDevice(Base):
    __tablename__ = "iot_devices"

    id          = Column(Integer, primary_key=True, index=True)
    device_id   = Column(String(64), unique=True, nullable=False)
    device_name = Column(String(120), nullable=False)
    api_key     = Column(String(128), nullable=False)
    is_active   = Column(Integer, default=1)
    created_at  = Column(DateTime, server_default=func.now())


class AnomalyReview(Base):
    __tablename__ = "anomaly_reviews"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, nullable=False, index=True)
    transaction_id = Column(Integer, nullable=False, index=True)
    status         = Column(Enum("verified", "flagged"), nullable=False)
    reviewed_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())

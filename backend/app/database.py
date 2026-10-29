# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root regardless of uvicorn working directory
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:root123@localhost:3306/finsight")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,          # seconds to wait for a connection from pool
    pool_recycle=1800,        # recycle connections every 30 min
    connect_args={"connect_timeout": 10},  # 10s MySQL connect timeout
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

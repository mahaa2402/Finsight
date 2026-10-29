# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.api import auth, transactions, budgets, analytics
from backend.app.database import engine
from backend.app import models

# Create tables automatically on startup (schema-first via schema.sql, but this is a safety net)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FinSight IQ Backend",
    description="Dynamic financial analytics backend — data stored in MySQL",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow CORS for the Vite frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api/auth",         tags=["auth"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(budgets.router,      prefix="/api/budgets",      tags=["budgets"])
app.include_router(analytics.router,    prefix="/api/analytics",    tags=["analytics"])


@app.get("/")
def root():
    return {"message": "FinSight IQ Backend v2.0 is running", "docs": "/docs"}


@app.get("/api/health")
def health():
    return {"status": "ok", "database": "mysql"}

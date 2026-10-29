# backend/app/api/transactions.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import date

from backend.app.database import get_db
from backend.app.models import Transaction, User
from backend.app.schemas import TransactionCreate, TransactionUpdate, TransactionOut, TransactionBatchCreate
from backend.app.api.auth import get_current_user

router = APIRouter()


# ── GET all transactions for current user (with optional filters) ──
@router.get("/", response_model=List[TransactionOut])
def list_transactions(
    type:      Optional[str]  = Query(None, description="income | expense"),
    category:  Optional[str]  = Query(None),
    from_date: Optional[date] = Query(None),
    to_date:   Optional[date] = Query(None),
    limit:     int            = Query(500, le=2000),
    offset:    int            = Query(0),
    current_user: User        = Depends(get_current_user),
    db:        Session        = Depends(get_db),
):
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if type:
        q = q.filter(Transaction.type == type)
    if category:
        q = q.filter(Transaction.category == category)
    if from_date:
        q = q.filter(Transaction.date >= from_date)
    if to_date:
        q = q.filter(Transaction.date <= to_date)
    return q.order_by(Transaction.date.desc(), Transaction.id.desc()).offset(offset).limit(limit).all()


# ── GET single transaction ──
@router.get("/{tx_id}", response_model=TransactionOut)
def get_transaction(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


# ── CREATE single transaction ──
@router.post("/", response_model=TransactionOut, status_code=201)
def create_transaction(
    data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = Transaction(
        user_id=current_user.id,
        type=data.type,
        category=data.category,
        payment_mode=data.payment_mode,
        description=data.description,
        amount=data.amount,
        date=data.date,
        source=data.source,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


# ── BATCH CREATE transactions (for CSV/Excel upload) ──
@router.post("/batch", response_model=List[TransactionOut], status_code=201)
def create_batch_transactions(
    payload: TransactionBatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    created_items = []
    for data in payload.transactions:
        tx = Transaction(
            user_id=current_user.id,
            type=data.type,
            category=data.category,
            payment_mode=data.payment_mode,
            description=data.description,
            amount=data.amount,
            date=data.date,
            source=data.source,
        )
        db.add(tx)
        created_items.append(tx)

    db.commit()
    for tx in created_items:
        db.refresh(tx)
    return created_items


# ── UPDATE transaction ──
@router.put("/{tx_id}", response_model=TransactionOut)
def update_transaction(
    tx_id: int,
    data: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if data.type is not None:
        tx.type = data.type
    if data.category is not None:
        tx.category = data.category
    if data.payment_mode is not None:
        tx.payment_mode = data.payment_mode
    if data.description is not None:
        tx.description = data.description
    if data.amount is not None:
        tx.amount = data.amount
    if data.date is not None:
        tx.date = data.date

    db.commit()
    db.refresh(tx)
    return tx


# ── DELETE transaction ──
@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    return None

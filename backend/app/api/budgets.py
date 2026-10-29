# backend/app/api/budgets.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models import Budget, Transaction, User
from backend.app.schemas import BudgetCreate, BudgetUpdate, BudgetOut
from backend.app.api.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[BudgetOut])
def list_budgets(
    month: Optional[int] = Query(None, ge=1, le=12),
    year:  Optional[int] = Query(None, ge=2020, le=2099),
    current_user: User   = Depends(get_current_user),
    db:    Session       = Depends(get_db),
):
    now = datetime.now()
    target_month = month or now.month
    target_year = year or now.year

    # Fetch user's budgets
    query = db.query(Budget).filter(Budget.user_id == current_user.id)
    if month is not None:
        query = query.filter(Budget.month == month)
    if year is not None:
        query = query.filter(Budget.year == year)

    budgets = query.order_by(Budget.created_at.asc()).all()

    # Calculate spent per category for this user in target month/year
    spending_query = (
        db.query(Transaction.category, func.sum(Transaction.amount).label("total_spent"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            extract("month", Transaction.date) == target_month,
            extract("year", Transaction.date) == target_year,
        )
        .group_by(Transaction.category)
        .all()
    )
    spent_map = {row.category: Decimal(str(row.total_spent or 0)) for row in spending_query}

    result = []
    for b in budgets:
        spent_amount = spent_map.get(b.category, Decimal("0.00"))
        result.append(
            BudgetOut(
                id=b.id,
                user_id=b.user_id,
                category=b.category,
                amount=b.amount,
                spent=spent_amount,
                month=b.month,
                year=b.year,
            )
        )
    return result


@router.post("/", response_model=BudgetOut, status_code=201)
def create_budget(
    data: BudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check if budget for same category/month/year already exists for this user
    existing = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.category == data.category,
        Budget.month == data.month,
        Budget.year == data.year,
    ).first()

    if existing:
        # Update existing
        existing.amount = data.amount
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        new_budget = Budget(
            user_id=current_user.id,
            category=data.category,
            amount=data.amount,
            month=data.month,
            year=data.year,
        )
        db.add(new_budget)
        db.commit()
        db.refresh(new_budget)
        target = new_budget

    # Calculate spent
    spent_row = (
        db.query(func.sum(Transaction.amount).label("total_spent"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.category == target.category,
            extract("month", Transaction.date) == target.month,
            extract("year", Transaction.date) == target.year,
        )
        .first()
    )
    spent_amount = Decimal(str(spent_row[0] or 0)) if spent_row and spent_row[0] else Decimal("0.00")

    return BudgetOut(
        id=target.id,
        user_id=target.user_id,
        category=target.category,
        amount=target.amount,
        spent=spent_amount,
        month=target.month,
        year=target.year,
    )


@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: int,
    data: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    if data.category is not None:
        budget.category = data.category
    if data.amount is not None:
        budget.amount = data.amount
    if data.month is not None:
        budget.month = data.month
    if data.year is not None:
        budget.year = data.year

    db.commit()
    db.refresh(budget)

    # Calculate spent
    spent_row = (
        db.query(func.sum(Transaction.amount).label("total_spent"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.category == budget.category,
            extract("month", Transaction.date) == budget.month,
            extract("year", Transaction.date) == budget.year,
        )
        .first()
    )
    spent_amount = Decimal(str(spent_row[0] or 0)) if spent_row and spent_row[0] else Decimal("0.00")

    return BudgetOut(
        id=budget.id,
        user_id=budget.user_id,
        category=budget.category,
        amount=budget.amount,
        spent=spent_amount,
        month=budget.month,
        year=budget.year,
    )


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.user_id == current_user.id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    db.delete(budget)
    db.commit()
    return None

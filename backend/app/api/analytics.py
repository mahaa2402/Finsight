# backend/app/api/analytics.py
"""
Analytics endpoints — aggregated data for Dashboard, Analytics, Forecast pages.
All computations are strictly isolated per authenticated user in MySQL.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models import Transaction, Budget, User, AnomalyReview
from backend.app.schemas import AnomalyReviewUpdate, AnomalySimulateRequest
from backend.app.api.auth import get_current_user
from backend.app.utils.anomaly_detector import detect_anomalies

router = APIRouter()


CATEGORY_COLORS = {
    "Food & Dining":      "#f43f5e",
    "Transportation":     "#f59e0b",
    "Shopping":           "#8b5cf6",
    "Bills":              "#0ea5e9",
    "Bills & Utilities":  "#0ea5e9",
    "Utilities":          "#0ea5e9",
    "Entertainment":      "#10b981",
    "Healthcare":         "#ec4899",
    "Travel":             "#f59e0b",
    "Rent":               "#6366f1",
    "Salary":             "#10b981",
    "Freelance":          "#3b82f6",
    "Investment":         "#8b5cf6",
    "Education":          "#14b8a6",
    "Others":             "#64748b",
}


# ── /analytics/summary ─────────────────────────
@router.get("/summary")
def get_summary(
    month:        Optional[int] = Query(None, ge=1, le=12),
    year:         Optional[int] = Query(None, ge=2000),
    current_user: User          = Depends(get_current_user),
    db:           Session       = Depends(get_db),
):
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if month:
        q = q.filter(extract("month", Transaction.date) == month)
    if year:
        q = q.filter(extract("year", Transaction.date) == year)

    rows = q.all()
    total_income  = sum(float(r.amount) for r in rows if r.type == "income")
    total_expense = sum(float(r.amount) for r in rows if r.type == "expense")
    savings       = total_income - total_expense
    savings_rate  = round((savings / total_income * 100), 1) if total_income > 0 else 0.0

    return {
        "total_income":  round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "savings":       round(savings, 2),
        "savings_rate":  savings_rate,
        "tx_count":      len(rows),
    }


# ── /analytics/monthly ─────────────────────────
@router.get("/monthly")
def get_monthly(
    months:       int     = Query(6, ge=1, le=24),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    rows = (
        db.query(
            extract("year",  Transaction.date).label("year"),
            extract("month", Transaction.date).label("month"),
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.user_id == current_user.id)
        .group_by("year", "month", Transaction.type)
        .order_by("year", "month")
        .all()
    )

    agg: dict = {}
    for row in rows:
        key = (int(row.year), int(row.month))
        if key not in agg:
            agg[key] = {"income": 0.0, "expense": 0.0}
        agg[key][row.type] += float(row.total)

    month_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                   "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    if not agg:
        # Return empty list or recent months with zeroes
        now = datetime.now()
        result = []
        for i in range(months - 1, -1, -1):
            m = (now.month - i - 1) % 12 + 1
            y = now.year - ((now.month - i - 1) // 12 * -1 if (now.month - i - 1) < 0 else 0)
            result.append({
                "month":      month_names[m],
                "year":       y,
                "income":     0.0,
                "expense":    0.0,
                "savings":    0.0,
                "budgetUsed": 0.0,
            })
        return result

    sorted_keys = sorted(agg.keys())[-months:]
    result = []
    for (yr, mo) in sorted_keys:
        inc = agg[(yr, mo)].get("income", 0.0)
        exp = agg[(yr, mo)].get("expense", 0.0)
        result.append({
            "month":      month_names[mo],
            "year":       yr,
            "income":     round(inc, 2),
            "expense":    round(exp, 2),
            "savings":    round(inc - exp, 2),
            "budgetUsed": 0.0,
        })
    return result


# ── /analytics/categories ──────────────────────
@router.get("/categories")
def get_categories(
    month:        Optional[int] = Query(None, ge=1, le=12),
    year:         Optional[int] = Query(None),
    current_user: User          = Depends(get_current_user),
    db:           Session       = Depends(get_db),
):
    q = (
        db.query(Transaction.category, func.sum(Transaction.amount).label("total"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense"
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    if month:
        q = q.filter(extract("month", Transaction.date) == month)
    if year:
        q = q.filter(extract("year", Transaction.date) == year)

    rows = q.all()
    result = [
        {
            "name":  row.category,
            "value": float(row.total),
            "color": CATEGORY_COLORS.get(row.category, "#64748b"),
        }
        for row in rows
    ]
    return result


# ── /analytics/payment-methods ─────────────────
@router.get("/payment-methods")
def get_payment_methods(
    month:        Optional[int] = Query(None, ge=1, le=12),
    year:         Optional[int] = Query(None),
    current_user: User          = Depends(get_current_user),
    db:           Session       = Depends(get_db),
):
    PM_COLORS = {
        "UPI":         "#6366f1",
        "Credit Card": "#f43f5e",
        "Debit Card":  "#0ea5e9",
        "Net Banking": "#38bdf8",
        "Cash":        "#10b981",
        "Wallet":      "#f59e0b",
    }

    q = (
        db.query(Transaction.payment_mode, func.sum(Transaction.amount).label("total"))
        .filter(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense"
        )
        .group_by(Transaction.payment_mode)
    )
    if month:
        q = q.filter(extract("month", Transaction.date) == month)
    if year:
        q = q.filter(extract("year", Transaction.date) == year)

    rows = q.all()
    grand_total = sum(float(r.total) for r in rows) or 1.0

    result = [
        {
            "name":       row.payment_mode,
            "value":      float(row.total),
            "percentage": round(float(row.total) / grand_total * 100, 1),
            "color":      PM_COLORS.get(row.payment_mode, "#64748b"),
        }
        for row in rows
    ]
    return result


# ── /analytics/recent ──────────────────────────
@router.get("/recent")
def get_recent(
    limit:        int     = Query(5, le=20),
    current_user: User    = Depends(get_current_user),
    db:           Session = Depends(get_db)
):
    rows = (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return rows


# ── /analytics/kpis ────────────────────────────
@router.get("/kpis")
def get_kpis(
    month:        Optional[int] = Query(None, ge=1, le=12),
    year:         Optional[int] = Query(None),
    current_user: User          = Depends(get_current_user),
    db:           Session       = Depends(get_db),
):
    """Aggregate KPIs for the Dashboard hero cards for current user."""
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if month:
        q = q.filter(extract("month", Transaction.date) == month)
    if year:
        q = q.filter(extract("year", Transaction.date) == year)

    rows = q.all()
    income  = sum(float(r.amount) for r in rows if r.type == "income")
    expense = sum(float(r.amount) for r in rows if r.type == "expense")
    savings = income - expense
    rate    = round(savings / income * 100, 1) if income > 0 else 0.0

    # Get all-time balance approximation for current user
    all_rows = db.query(Transaction).filter(Transaction.user_id == current_user.id).all()
    all_income  = sum(float(r.amount) for r in all_rows if r.type == "income")
    all_expense = sum(float(r.amount) for r in all_rows if r.type == "expense")
    balance = all_income - all_expense

    # Calculate budget utilization
    now = datetime.now()
    target_month = month or now.month
    target_year = year or now.year
    user_budgets = db.query(Budget).filter(
        Budget.user_id == current_user.id,
        Budget.month == target_month,
        Budget.year == target_year
    ).all()
    total_budget_limit = sum(float(b.amount) for b in user_budgets)
    budget_used_pct = round((expense / total_budget_limit * 100), 1) if total_budget_limit > 0 else 0.0

    return {
        "income":        round(income, 2),
        "expense":       round(expense, 2),
        "savings":       round(savings, 2),
        "savings_rate":  rate,
        "balance":       round(balance, 2),
        "budget_used":   budget_used_pct,
    }


# ── /analytics/anomalies ─────────────────────────
@router.get("/anomalies")
def get_anomalies(
    algorithm:    str           = Query("zscore", description="zscore | iqr | isolation_forest"),
    threshold:    float         = Query(2.5, ge=1.0, le=5.0),
    month:        Optional[int] = Query(None, ge=1, le=12),
    year:         Optional[int] = Query(None),
    current_user: User          = Depends(get_current_user),
    db:           Session       = Depends(get_db),
):
    """
    Dynamically detect anomalies in user's real-time transaction dataset
    using statistical or machine learning algorithms.
    """
    q = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if month:
        q = q.filter(extract("month", Transaction.date) == month)
    if year:
        q = q.filter(extract("year", Transaction.date) == year)

    txs = q.order_by(Transaction.date.desc()).all()

    # Fetch existing audit reviews by user
    review_rows = db.query(AnomalyReview).filter(AnomalyReview.user_id == current_user.id).all()
    reviews_map = {r.transaction_id: r.status for r in review_rows}

    # Run algorithmic anomaly detector
    result = detect_anomalies(
        transactions=txs,
        algorithm=algorithm,
        threshold=threshold,
        reviews=reviews_map
    )

    return result


# ── /analytics/anomalies/{tx_id}/status ──────────
@router.post("/anomalies/{tx_id}/status")
def update_anomaly_status(
    tx_id:        int,
    payload:      AnomalyReviewUpdate,
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Persistently flag or verify an outlier transaction in user's audit review log.
    """
    tx = db.query(Transaction).filter(
        Transaction.id == tx_id,
        Transaction.user_id == current_user.id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found or unauthorized")

    review = db.query(AnomalyReview).filter(
        AnomalyReview.user_id == current_user.id,
        AnomalyReview.transaction_id == tx_id
    ).first()

    if review:
        review.status = payload.status
    else:
        review = AnomalyReview(
            user_id=current_user.id,
            transaction_id=tx_id,
            status=payload.status
        )
        db.add(review)

    db.commit()
    db.refresh(review)

    return {
        "status": "ok",
        "transaction_id": tx_id,
        "review_status": review.status,
        "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None
    }


# ── /analytics/simulate-anomaly ──────────────────
@router.post("/simulate-anomaly")
def simulate_anomaly(
    payload:      Optional[AnomalySimulateRequest] = None,
    current_user: User = Depends(get_current_user),
    db:           Session = Depends(get_db),
):
    """
    Helper endpoint to inject a real-time anomalous expense so the user can immediately
    witness the statistical algorithm flagging real-time live data spikes.
    """
    cat = payload.category if payload and payload.category else "Shopping"
    amt = payload.amount if payload and payload.amount else Decimal("18500.00")
    desc = payload.description if payload and payload.description else "Luxury Electronics Spike"

    spike_tx = Transaction(
        user_id=current_user.id,
        type="expense",
        category=cat,
        payment_mode="Credit Card",
        description=desc,
        amount=amt,
        date=date.today(),
        source="ui"
    )
    db.add(spike_tx)
    db.commit()
    db.refresh(spike_tx)

    return {
        "status": "simulated",
        "transaction": {
            "id": spike_tx.id,
            "category": spike_tx.category,
            "amount": float(spike_tx.amount),
            "date": str(spike_tx.date),
            "description": spike_tx.description,
        }
    }


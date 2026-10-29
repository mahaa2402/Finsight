# backend/app/utils/anomaly_detector.py
"""
Algorithmic Real-Time Anomaly Detection Engine for FinSight IQ.
Supports:
1. Gaussian Z-Score (|x - μ| / σ)
2. Interquartile Range (Tukey's Fences IQR)
3. Isolation Forest (Machine Learning Ensemble from scikit-learn)
"""
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from datetime import datetime
from sklearn.ensemble import IsolationForest


def detect_anomalies(
    transactions: List[Any],
    algorithm: str = "zscore",
    threshold: float = 2.5,
    reviews: Optional[Dict[int, str]] = None
) -> Dict[str, Any]:
    """
    Executes algorithmic outlier detection on dynamic transaction data.
    
    :param transactions: List of SQLAlchemy Transaction models
    :param algorithm: 'zscore' | 'iqr' | 'isolation_forest'
    :param threshold: sensitivity multiplier (e.g. 1.5 - 4.0)
    :param reviews: Dict mapping transaction_id to review status ('verified' | 'flagged')
    """
    if reviews is None:
        reviews = {}

    # Extract expense transactions for analysis
    data = []
    for tx in transactions:
        amt = float(tx.amount)
        data.append({
            "id": tx.id,
            "category": tx.category or "General",
            "amount": amt,
            "date": str(tx.date),
            "description": tx.description or "",
            "payment_mode": tx.payment_mode or "Other",
            "type": tx.type,
            "created_at": str(tx.created_at) if hasattr(tx, "created_at") else "",
        })

    # Total count of all transactions
    total_tx_count = len(data)
    
    # Focus primarily on expenses for security and overspend detection
    expense_txs = [d for d in data if d["type"] == "expense"]
    
    if len(expense_txs) < 3:
        # Too few expenses for deep statistical modelling, return empty with metadata
        return {
            "anomalies": [],
            "metrics": {
                "total_analyzed": total_tx_count,
                "expense_count": len(expense_txs),
                "anomalies_count": 0,
                "pending_count": 0,
                "flagged_count": 0,
                "verified_count": 0,
                "exposure_sum": 0.0,
                "sensitivity": threshold,
                "algorithm": algorithm,
                "analyzed_at": datetime.now().isoformat(),
            }
        }

    df = pd.DataFrame(expense_txs)
    anomalies: List[Dict[str, Any]] = []

    # Map algorithm
    algo = (algorithm or "zscore").lower()

    if algo == "iqr":
        anomalies = _detect_iqr(df, threshold, reviews)
    elif algo == "isolation_forest":
        anomalies = _detect_isolation_forest(df, threshold, reviews)
    else:  # default zscore
        anomalies = _detect_zscore(df, threshold, reviews)

    # Sort anomalies descending by severity and date
    severity_order = {"critical": 0, "high": 1, "moderate": 2}
    anomalies.sort(key=lambda x: (severity_order.get(x["severity"], 3), -x["amount"]))

    pending_count = sum(1 for a in anomalies if a["status"] == "pending")
    flagged_count = sum(1 for a in anomalies if a["status"] == "flagged")
    verified_count = sum(1 for a in anomalies if a["status"] == "verified")
    exposure_sum = sum(a["amount"] for a in anomalies if a["status"] != "verified")

    return {
        "anomalies": anomalies,
        "metrics": {
            "total_analyzed": total_tx_count,
            "expense_count": len(expense_txs),
            "anomalies_count": len(anomalies),
            "pending_count": pending_count,
            "flagged_count": flagged_count,
            "verified_count": verified_count,
            "exposure_sum": round(exposure_sum, 2),
            "sensitivity": threshold,
            "algorithm": algo,
            "analyzed_at": datetime.now().isoformat(),
        }
    }


def _detect_zscore(df: pd.DataFrame, threshold: float, reviews: Dict[int, str]) -> List[Dict[str, Any]]:
    anomalies = []
    
    # Calculate global expense stats
    global_mean = float(df["amount"].mean())
    global_std = float(df["amount"].std()) or 1.0

    # Group by category
    for category, group in df.groupby("category"):
        amounts = group["amount"].values
        n = len(amounts)
        
        if n >= 3:
            cat_mean = float(np.mean(amounts))
            cat_std = float(np.std(amounts, ddof=1)) or (cat_mean * 0.1) or 1.0
        else:
            # Fallback to global statistics if category has too few records
            cat_mean = global_mean
            cat_std = global_std

        typical_min = max(0.0, round(cat_mean - 1.0 * cat_std, 2))
        typical_max = round(cat_mean + 1.5 * cat_std, 2)

        for _, row in group.iterrows():
            amt = float(row["amount"])
            z_score = (amt - cat_mean) / cat_std

            if z_score >= threshold:
                tx_id = int(row["id"])
                
                if z_score >= 3.5:
                    severity = "critical"
                elif z_score >= 2.5:
                    severity = "high"
                else:
                    severity = "moderate"

                merchant_name = row["description"].strip() if row["description"].strip() else f"{row['payment_mode']} ({row['category']})"
                
                reason = (
                    f"Outlay of ₹{amt:,.0f} deviates by {z_score:.2f}σ from the "
                    f"{category} mean of ₹{cat_mean:,.0f}. Normal range is ₹{typical_min:,.0f} - ₹{typical_max:,.0f}."
                )

                anomalies.append({
                    "id": f"anom-{tx_id}",
                    "transaction_id": tx_id,
                    "category": category,
                    "amount": amt,
                    "typicalMin": typical_min,
                    "typicalMax": typical_max,
                    "date": row["date"],
                    "merchant": merchant_name,
                    "zScore": round(float(z_score), 2),
                    "severity": severity,
                    "status": reviews.get(tx_id, "pending"),
                    "reason": reason,
                    "algorithm": "Gaussian Z-Score"
                })

    return anomalies


def _detect_iqr(df: pd.DataFrame, threshold: float, reviews: Dict[int, str]) -> List[Dict[str, Any]]:
    anomalies = []
    
    # Scale multiplier with threshold: standard IQR multiplier is 1.5 at threshold 2.5
    iqr_multiplier = round(1.5 * (threshold / 2.5), 2)
    
    global_q1 = float(df["amount"].quantile(0.25))
    global_q3 = float(df["amount"].quantile(0.75))
    global_iqr = (global_q3 - global_q1) or (global_q3 * 0.5) or 1.0

    for category, group in df.groupby("category"):
        amounts = group["amount"].values
        n = len(amounts)
        
        if n >= 4:
            q1 = float(np.percentile(amounts, 25))
            q3 = float(np.percentile(amounts, 75))
            iqr = (q3 - q1) or (q3 * 0.4) or 1.0
        else:
            q1 = global_q1
            q3 = global_q3
            iqr = global_iqr

        upper_bound = q3 + (iqr_multiplier * iqr)
        typical_min = max(0.0, round(q1, 2))
        typical_max = round(q3 + iqr, 2)

        for _, row in group.iterrows():
            amt = float(row["amount"])
            if amt > upper_bound:
                tx_id = int(row["id"])
                excess_ratio = amt / upper_bound if upper_bound > 0 else 1.0
                
                # Approximate z-score for consistent metric display
                approx_z = round((amt - q3) / (iqr or 1.0), 2)

                if excess_ratio >= 2.0 or approx_z >= 3.5:
                    severity = "critical"
                elif excess_ratio >= 1.4 or approx_z >= 2.5:
                    severity = "high"
                else:
                    severity = "moderate"

                merchant_name = row["description"].strip() if row["description"].strip() else f"{row['payment_mode']} ({row['category']})"
                reason = (
                    f"Outlay ₹{amt:,.0f} exceeds Tukey's upper boundary (Q3 + {iqr_multiplier}×IQR = ₹{upper_bound:,.0f}) "
                    f"by {excess_ratio:.1f}x. 75th percentile is ₹{q3:,.0f}."
                )

                anomalies.append({
                    "id": f"anom-{tx_id}",
                    "transaction_id": tx_id,
                    "category": category,
                    "amount": amt,
                    "typicalMin": typical_min,
                    "typicalMax": typical_max,
                    "date": row["date"],
                    "merchant": merchant_name,
                    "zScore": approx_z,
                    "severity": severity,
                    "status": reviews.get(tx_id, "pending"),
                    "reason": reason,
                    "algorithm": "Interquartile Range (IQR)"
                })

    return anomalies


def _detect_isolation_forest(df: pd.DataFrame, threshold: float, reviews: Dict[int, str]) -> List[Dict[str, Any]]:
    anomalies = []
    n_samples = len(df)
    
    if n_samples < 5:
        # Fall back to z-score for very small datasets
        return _detect_zscore(df, threshold, reviews)

    # Feature engineering for ML model:
    # 1. Amount
    # 2. Category code
    # 3. Day of week
    # 4. Day of month
    df_work = df.copy()
    df_work["date_dt"] = pd.to_datetime(df_work["date"], errors="coerce").fillna(pd.Timestamp.now())
    df_work["day_of_week"] = df_work["date_dt"].dt.dayofweek
    df_work["day_of_month"] = df_work["date_dt"].dt.day
    
    # Categorical label encoding
    cat_map = {cat: idx for idx, cat in enumerate(df_work["category"].unique())}
    df_work["cat_code"] = df_work["category"].map(cat_map)

    features = ["amount", "cat_code", "day_of_week", "day_of_month"]
    X = df_work[features].values

    # Contamination based on threshold: higher threshold = lower contamination (fewer outliers)
    # Sensitivity range [1.5, 4.0] -> contamination [0.15, 0.02]
    contamination = max(0.02, min(0.20, 0.08 * (2.5 / max(threshold, 0.5))))

    clf = IsolationForest(
        n_estimators=100,
        contamination=contamination,
        random_state=42
    )
    clf.fit(X)

    # Predictions (-1 = anomaly, 1 = inlier)
    preds = clf.predict(X)
    scores = clf.decision_function(X)  # lower = more abnormal

    # Overall stats for baseline comparison
    cat_means = df_work.groupby("category")["amount"].mean().to_dict()
    cat_stds = df_work.groupby("category")["amount"].std().fillna(1.0).to_dict()

    for idx, row in df_work.iterrows():
        if preds[idx] == -1:  # Anomaly detected by Isolation Forest
            tx_id = int(row["id"])
            amt = float(row["amount"])
            category = row["category"]
            c_mean = float(cat_means.get(category, amt))
            c_std = float(cat_stds.get(category, 1.0)) or 1.0
            z_score = round(max(0.1, (amt - c_mean) / c_std), 2)
            
            score_val = float(scores[idx])  # negative score
            
            if score_val < -0.15 or z_score >= 3.5:
                severity = "critical"
            elif score_val < -0.08 or z_score >= 2.5:
                severity = "high"
            else:
                severity = "moderate"

            typical_min = max(0.0, round(c_mean - c_std, 2))
            typical_max = round(c_mean + 1.5 * c_std, 2)
            merchant_name = row["description"].strip() if row["description"].strip() else f"{row['payment_mode']} ({row['category']})"

            reason = (
                f"Isolation Forest ensemble flagged abnormal transaction (anomaly score: {score_val:.3f}). "
                f"Amount ₹{amt:,.0f} deviates from regular multi-dimensional patterns."
            )

            anomalies.append({
                "id": f"anom-{tx_id}",
                "transaction_id": tx_id,
                "category": category,
                "amount": amt,
                "typicalMin": typical_min,
                "typicalMax": typical_max,
                "date": row["date"],
                "merchant": merchant_name,
                "zScore": z_score,
                "severity": severity,
                "status": reviews.get(tx_id, "pending"),
                "reason": reason,
                "algorithm": "Isolation Forest (Tree Ensemble)"
            })

    return anomalies

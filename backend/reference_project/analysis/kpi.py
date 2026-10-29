# KPI calculations for financial overview
import pandas as pd


def total_income(df: pd.DataFrame) -> float:
    """Sum of all income transactions."""
    return df.loc[df["Type"] == "Income", "Amount"].sum()


def total_expense(df: pd.DataFrame) -> float:
    """Sum of all expense transactions."""
    return df.loc[df["Type"] == "Expense", "Amount"].sum()


def savings(df: pd.DataFrame) -> float:
    return total_income(df) - total_expense(df)


def savings_rate(df: pd.DataFrame) -> float:
    inc = total_income(df)
    return (savings(df) / inc) * 100 if inc != 0 else 0

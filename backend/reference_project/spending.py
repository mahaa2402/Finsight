# Placeholder for spending analysis functions.
import pandas as pd

def expense_by_category(df: pd.DataFrame) -> pd.Series:
    """Return total expense per category."""
    expenses = df[df["Type"] == "Expense"]
    return expenses.groupby("Category")["Amount"].sum()

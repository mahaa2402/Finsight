# Placeholder for budget analysis functions.
import pandas as pd

def budget_utilization(df: pd.DataFrame, budgets: pd.DataFrame) -> pd.DataFrame:
    """Calculate budget utilization per category and month."""
    expenses = df[df["Type"] == "Expense"]
    expenses['Month'] = expenses['Date'].dt.to_period('M')
    exp_sum = expenses.groupby(['Category', 'Month'])['Amount'].sum().reset_index()
    budgets['Month'] = pd.to_datetime(budgets['month']).dt.to_period('M')
    merged = pd.merge(exp_sum, budgets, on=['Category', 'Month'], how='left')
    merged['Utilization'] = (merged['Amount'] / merged['budget_amount']) * 100
    return merged

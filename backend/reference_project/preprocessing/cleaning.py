# Placeholder for data cleaning and validation functions.
import pandas as pd


def clean_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """Perform basic cleaning: drop duplicates, parse dates, coerce amounts, handle missing values, and standardize categories."""
    df = df.drop_duplicates()
    df["Date"] = pd.to_datetime(df["Date"], errors='coerce')
    df["Amount"] = pd.to_numeric(df["Amount"], errors='coerce')
    # Drop rows with essential missing values
    df = df.dropna(subset=["Date", "Type", "Category", "Amount"])
    df["Category"] = df["Category"].str.strip().str.title()
    return df

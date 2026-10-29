import pandas as pd
import os


def load_transactions(csv_path: str) -> pd.DataFrame:
    """Load transactions from a CSV or Excel file into a DataFrame.
    Supports .csv and .xlsx extensions.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"File not found: {csv_path}")
    ext = os.path.splitext(csv_path)[1].lower()
    if ext == '.csv':
        df = pd.read_csv(csv_path)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(csv_path)
    else:
        raise ValueError('Unsupported file format: {ext}')
    return df

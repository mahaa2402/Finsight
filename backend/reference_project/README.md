# FinSight IQ

Smart Money Management & Business Intelligence System

## Overview
FinSight IQ is a personal finance management application built with Streamlit, MySQL, Python, and Power BI. It provides descriptive, diagnostic, predictive, and recommendation analytics on financial transaction data.

## Project Structure
```
FinSight-IQ/
├── app.py
├── requirements.txt
├── README.md
├── database/
│   ├── db_connection.py
│   └── queries.py
├── data/
│   ├── sample_transactions.csv
│   └── data_loader.py
├── preprocessing/
│   └── cleaning.py
├── analysis/
│   ├── kpi.py
│   ├── spending.py
│   └── budget.py
├── ml/
│   ├── forecasting.py
│   └── anomaly_detection.py
├── recommendations/
│   └── rules.py
├── dashboard/
│   └── charts.py
└── models/
    └── trained_model.pkl
```

## Setup
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure MySQL connection in `database/db_connection.py`.
3. Run the Streamlit app:
   ```bash
   streamlit run app.py
   ```

## License
MIT

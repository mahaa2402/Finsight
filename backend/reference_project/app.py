import streamlit as st
import hashlib
import pandas as pd

# ---- Dark theme styling ----
st.set_page_config(page_title="FinSight IQ", page_icon="💰", layout="centered")
st.markdown(
    """
    <style>
    .main {background-color: #121212; color: #FFFFFF;}
    .stButton>button {background-color: #1E88E5; color: white;}
    .stTextInput>div>div>input {background-color: #1e1e1e; color: #fff; border: none;}
    </style>
    """,
    unsafe_allow_html=True,
)

# ---- Helper functions ----

def hash_password(pwd: str) -> str:
    """Return a SHA‑256 hash of the password (placeholder)."""
    return hashlib.sha256(pwd.encode()).hexdigest()

# ---- Session state defaults ----
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False
if "show_register" not in st.session_state:
    st.session_state["show_register"] = False

# ---- Login page ----

def login_page():
    st.title("FinSight IQ – Login")
    email = st.text_input("Email")
    password = st.text_input("Password", type="password")
    col1, col2 = st.columns([2, 1])
    with col1:
        if st.button("Login"):
            if email and password:
                # TODO: verify against DB
                st.session_state["logged_in"] = True
                st.session_state["user_email"] = email
                st.success("Logged in successfully")
            else:
                st.error("Please enter both email and password")
    with col2:
        if st.button("Register"):
            st.session_state["show_register"] = True

# ---- Registration page ----

def register_page():
    st.title("FinSight IQ – Register")
    name = st.text_input("Name")
    email = st.text_input("Email (new)")
    password = st.text_input("Password", type="password")
    if st.button("Create Account"):
        if name and email and password:
            pwd_hash = hash_password(password)
            # TODO: store (email, pwd_hash) in DB
            st.session_state["logged_in"] = True
            st.session_state["user_email"] = email
            st.success("Account created and logged in")
        else:
            st.error("All fields are required")
    if st.button("Back to Login"):
        st.session_state["show_register"] = False

# ---- Main dashboard (post‑login) ----

def dashboard_page():
    st.title("FinSight IQ – Dashboard")
    st.success(f"Welcome, {st.session_state.get('user_email')}")
    st.subheader("Add Transactions")
    option = st.radio("Select input method", ["CSV Upload", "Manual Entry"])
    if option == "CSV Upload":
        uploaded_file = st.file_uploader("Choose CSV or Excel file", type=["csv", "xlsx"])
        if uploaded_file is not None:
            try:
                if uploaded_file.name.endswith('.csv'):
                    df = pd.read_csv(uploaded_file)
                else:
                    df = pd.read_excel(uploaded_file)
                st.success(f"Loaded {df.shape[0]} records")
                st.dataframe(df.head())
                # TODO: clean and insert into MySQL
            except Exception as e:
                st.error(f"Error reading file: {e}")
    else:
        with st.form(key="manual_entry"):
            col1, col2 = st.columns(2)
            with col1:
                date = st.date_input("Date")
                trans_type = st.selectbox("Type", ["Income", "Expense"])
                category = st.text_input("Category")
            with col2:
                subcategory = st.text_input("Subcategory")
                amount = st.number_input("Amount", min_value=0.0, format="%.2f")
                payment_mode = st.selectbox("Payment Mode", ["Cash", "UPI", "Card", "Bank Transfer"])
            description = st.text_area("Description")
            submit = st.form_submit_button("Add Transaction")
            if submit:
                transaction = {
                    "Date": str(date),
                    "Type": trans_type,
                    "Category": category,
                    "Subcategory": subcategory,
                    "Description": description,
                    "Amount": amount,
                    "Payment_Mode": payment_mode,
                }
                if "manual_entries" not in st.session_state:
                    st.session_state["manual_entries"] = []
                st.session_state["manual_entries"].append(transaction)
                st.success("Transaction added")
                st.write(transaction)
    if st.button("Log out"):
        st.session_state["logged_in"] = False
        st.session_state["show_register"] = False
        st.experimental_rerun()

# ---- Routing logic ----
if not st.session_state["logged_in"]:
    if st.session_state["show_register"]:
        register_page()
    else:
        login_page()
else:
    dashboard_page()

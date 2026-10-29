# Placeholder for common SQL queries used across the app.

def get_user_by_email(cursor, email):
    query = "SELECT * FROM users WHERE email = %s"
    cursor.execute(query, (email,))
    return cursor.fetchone()

def insert_transaction(cursor, transaction):
    query = """
    INSERT INTO transactions (user_id, transaction_date, transaction_type, category, subcategory, description, amount, payment_mode)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    cursor.execute(query, (
        transaction["user_id"],
        transaction["date"],
        transaction["type"],
        transaction["category"],
        transaction.get("subcategory"),
        transaction.get("description"),
        transaction["amount"],
        transaction["payment_mode"]
    ))
    return cursor.lastrowid

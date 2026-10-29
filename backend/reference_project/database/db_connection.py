import os
import mysql.connector
from mysql.connector import Error


def get_connection():
    """Create and return a MySQL connection.
    Update the connection parameters as needed for your environment.
    """
    try:
        connection = mysql.connector.connect(
            host='localhost',
            database='finsight_iq',
            user='your_user',
            password='your_password'
        )
        if connection.is_connected():
            return connection
    except Error as e:
        raise RuntimeError(f"Error connecting to MySQL: {e}")

    return None

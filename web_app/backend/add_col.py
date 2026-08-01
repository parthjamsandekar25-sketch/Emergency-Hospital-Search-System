import sys
import os

# Add the current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import get_db_connection

try:
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS patient_name VARCHAR(150);")
    conn.commit()
    conn.close()
    print("Column patient_name added successfully to bookings.")
except Exception as e:
    print(e)

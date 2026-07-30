import mysql.connector
from dotenv import load_dotenv
import os
load_dotenv()
try:
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "prafullhospital123"),
        database=os.getenv("DB_NAME", "hospital_db")
    )
    cur = conn.cursor()
    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS patient_name VARCHAR(150);")
    conn.commit()
    conn.close()
    print("Column patient_name added successfully to bookings.")
except Exception as e:
    print(e)

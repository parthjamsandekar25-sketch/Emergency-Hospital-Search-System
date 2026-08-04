import os
import sys
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path: sys.path.insert(0, current_dir)

from database import get_db_connection

def setup_global_tables():
    conn = get_db_connection()
    cur = conn.cursor()

    # Add is_banned column safely to all three tables
    for table in ['hospitals', 'patients', 'drivers']:
        try:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN is_banned BOOLEAN DEFAULT FALSE")
        except Exception as e:
            if 'Duplicate column name' not in str(e) and '1060' not in str(e):
                print(f"Issue adding to {table}: {e}")

    # Create support_queries table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS support_queries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_type VARCHAR(50),
        name VARCHAR(255),
        email VARCHAR(255),
        contact VARCHAR(50),
        query_text TEXT,
        status VARCHAR(50) DEFAULT 'Pending',
        reply_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()
    print("Global tables and columns added successfully!")

if __name__ == '__main__':
    setup_global_tables()

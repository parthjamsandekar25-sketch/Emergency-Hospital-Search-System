import os
import sys
import bcrypt

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from database import get_db_connection

def setup_superadmin_tables():
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS superadmins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS pending_hospitals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address_label VARCHAR(255),
        support_email VARCHAR(255) NOT NULL,
        contact_number VARCHAR(100),
        latitude FLOAT,
        longitude FLOAT,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'unverified_email',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    cur.execute("""
    CREATE TABLE IF NOT EXISTS pending_hospital_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hospital_id INT NOT NULL,
        address_label VARCHAR(255),
        contact_number VARCHAR(100),
        latitude FLOAT,
        longitude FLOAT,
        status VARCHAR(50) DEFAULT 'unverified_email',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hospital_id) REFERENCES hospitals(hospital_id) ON DELETE CASCADE
    )
    """)

    # Default Super Admin credentials for initial setup
    password = 'admin'
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    try:
        cur.execute("INSERT INTO superadmins (email, password_hash) VALUES (%s, %s)", ('superadmin@system.com', hashed))
    except Exception:
        pass # Ignore if duplicate
        
    conn.commit()
    conn.close()
    print("Super Admin database tables created successfully!")

if __name__ == '__main__':
    setup_superadmin_tables()

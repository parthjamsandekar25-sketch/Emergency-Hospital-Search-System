import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

conn = mysql.connector.connect(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT', 3306)),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD'),
    database=os.getenv('DB_NAME')
)
cursor = conn.cursor()

with open('init.sql', 'r') as f:
    sql = f.read()

for statement in sql.split(';'):
    if statement.strip():
        try:
            cursor.execute(statement)
        except Exception as e:
            print("Notice:", e)

conn.commit()
conn.close()
print("Success! Cloud database tables created.")

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')

def check_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT action_value FROM activity_logs")
    rows = cursor.fetchall()
    print("--- DISTINCT ACTIONS IN DB ---")
    for row in rows:
        print(row[0])
    conn.close()

if __name__ == "__main__":
    check_db()

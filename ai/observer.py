import time
import sqlite3
import os
import psutil
import json
import ctypes
from brain_hmm import BrainHMM

# CONFIG
DB_PATH = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')
DEBOUNCE_SECONDS = 1.5 # Only log if window stays open for 1.5s
IGNORE_LIST = ["Task Switching", "Program Manager", "Windows Input Experience", ""]

brain = BrainHMM()

def init_db():
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT NOT NULL,
                action_value TEXT NOT NULL,
                accepted BOOLEAN
            )
        ''')
        conn.commit()
        conn.close()
        print("[INFO] DB Initialized.")
        
        # Load History
        brain.load_data()
    except Exception as e:
        print(f"[ERROR] DB Init: {e}")

def get_active_window():
    """Robust Window Title Retrieval via ctypes."""
    try:
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd: return None
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        if not length: return None
        buff = ctypes.create_unicode_buffer(length + 1)
        ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value
        
        # CLEANUP
        if not title: return None
        if title in IGNORE_LIST: return None
        
        # Remove aggressive noise
        t_lower = title.lower()
        if "overlay" in t_lower: # Only ignore our overlay, allow DIVA main window
            return None 
            
        # NORMALIZATION RULES (Order Matters)
        # 1. VS Code
        if "Visual Studio Code" in title or "VS Code" in title:
            return "Visual Studio Code"
            
        # 2. Chrome/Edge/Browser
        if " - Google Chrome" in title or "Chrome" in title:
            return "Google Chrome"
        if " - Microsoft Edge" in title or "Edge" in title:
            return "Microsoft Edge"
            
        # 3. DIVA (The Assistant Itself)
        if "DIVA" in title and "Visual Studio Code" not in title: 
            return "DIVA Assistant"

        # 4. Common Apps
        if "Spotify" in title: return "Spotify"
        if "Calculator" in title: return "Calculator"
        if "Notepad" in title: return "Notepad"
        if "Explorer" in title: return "File Explorer"
        
        # 5. Fallback: Return simplified title or None if too noisy
        # return title # <--- PREVIOUSLY RETURNED RAW TITLE
        return title.split(' - ')[-1] # Try to get the last part (App Name usually)
    except:
        return None

def log_and_predict(app_name):
    """Log to DB and Ask Brain for next move."""
    try:
        # LOG
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO activity_logs (action_type, action_value) VALUES (?, ?)", 
                       ("APP_FOCUS", app_name))
        conn.commit()
        conn.close()
        print(f"[LOG] {app_name}")
        
        # PREDICT
        prediction = brain.predict(app_name)
        if prediction:
            # Emit JSON for Electron
            print(f"JSON_PREDICTION: {json.dumps(prediction)}", flush=True)
            
    except Exception as e:
        print(f"[ERROR] Log Failed: {e}")

def main():
    print("[OBSERVER] Watching...")
    init_db()
    
    last_window = None
    last_change_time = time.time()
    
    while True:
        try:
            current = get_active_window()
            
            if current and current != last_window:
                # Started a switch, wait for stability (Debounce)
                start_wait = time.time()
                is_stable = True
                
                # Wait DEBOUNCE_SECONDS to see if it stays
                while time.time() - start_wait < DEBOUNCE_SECONDS:
                    check = get_active_window()
                    if check != current:
                        is_stable = False # User kept switching
                        break
                    time.sleep(0.1)
                
                if is_stable and current != last_window:
                   # It's a real focused app
                   # 1. Learn (Transition)
                   if last_window: brain.learn(last_window, current)
                   
                   # 2. Log & Predict
                   log_and_predict(current)
                   
                   last_window = current
            
            time.sleep(0.5)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"[ERROR] Loop: {e}")
            time.sleep(1)

if __name__ == "__main__":
    main()

import time         # Used for sleep (debouncing) and timestamps
import sqlite3      # Used to log activity to local database
import os           # Used for file path resolution
import psutil       # (Unused import, but typically used for process management)
import json         # Used to format output as JSON
import ctypes       # Used to call Windows API (User32.dll)
from brain_hmm import BrainHMM # Import our custom AI prediction class

# CONFIGURATION
# Resolve absolute path to the SQLite database
DB_PATH = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')
DEBOUNCE_SECONDS = 1.5 # Only log if window stays open/focused for 1.5s
# List of window titles to ignore (system hidden windows)
IGNORE_LIST = ["Task Switching", "Program Manager", "Windows Input Experience", ""]

# Initialize the Brain (Hidden Markov Model)
brain = BrainHMM()

def init_db():
    """Initialize the SQLite database table if it doesn't exist."""
    try:
        conn = sqlite3.connect(DB_PATH) # Connect to DB
        cursor = conn.cursor()
        # Create table to store logs if missing
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS activity_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                action_type TEXT NOT NULL,
                action_value TEXT NOT NULL,
                accepted BOOLEAN
            )
        ''')
        conn.commit() # Save changes
        conn.close()  # Close connection
        print("[INFO] DB Initialized.")
        
        # Load History into Brain for training
        brain.load_data()
    except Exception as e:
        print(f"[ERROR] DB Init: {e}")

def get_active_window():
    """
    Robust Window Title Retrieval via Windows API (ctypes).
    Returns the title of the currently focused window.
    """
    try:
        # 1. Get Handle (HWND) of the foreground window
        hwnd = ctypes.windll.user32.GetForegroundWindow()
        if not hwnd: return None # No window focused

        # 2. Get the length of the window title text
        length = ctypes.windll.user32.GetWindowTextLengthW(hwnd)
        if not length: return None # Empty title

        # 3. Create a buffer to store the title
        buff = ctypes.create_unicode_buffer(length + 1)
        
        # 4. Copy the title into the buffer
        ctypes.windll.user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value # Extract string from buffer
        
        # CLEANUP / FILTERING
        if not title: return None
        if title in IGNORE_LIST: return None # System windows
        
        # Remove aggressive noise (e.g. valid windows we don't care about)
        t_lower = title.lower()
        if "overlay" in t_lower: # Only ignore our overlay, allow DIVA main window
            return None 
            
        # NORMALIZATION RULES (Order Matters)
        # We simplify complex titles into standard App Names for better AI training.
        
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
        # We try to get the last part (App Name) usually found after ' - '
        return title.split(' - ')[-1] 
    except:
        return None # Return None on any API error

def log_and_predict(app_name):
    """Log the focused app to DB and ask Brain for next move."""
    try:
        # LOGGING STEP
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        # Insert new log entry
        cursor.execute("INSERT INTO activity_logs (action_type, action_value) VALUES (?, ?)", 
                       ("APP_FOCUS", app_name))
        conn.commit()
        conn.close()
        print(f"[LOG] {app_name}")
        
        # PREDICTION STEP
        # Ask the brain what usually comes after this app
        prediction = brain.predict(app_name)
        if prediction:
            # Emit JSON for Electron to read via stdout
            print(f"JSON_PREDICTION: {json.dumps(prediction)}", flush=True)
            
    except Exception as e:
        print(f"[ERROR] Log Failed: {e}")

def main():
    print("[OBSERVER] Watching...")
    init_db() # Ensure DB is ready
    
    last_window = None          # Track previous window
    last_change_time = time.time() # Track time of last change
    
    # Infinite Loop (The "Heartbeat" of the Observer)
    while True:
        try:
            current = get_active_window() # Poll current window
            
            # Detect a change in focus
            if current and current != last_window:
                # Started a switch, wait for stability (Debounce)
                start_wait = time.time()
                is_stable = True
                
                # Wait DEBOUNCE_SECONDS (1.5s) to see if the user stays on this window.
                # This prevents logging Alt-Tab cycling or rapid switching.
                while time.time() - start_wait < DEBOUNCE_SECONDS:
                    check = get_active_window()
                    if check != current:
                        is_stable = False # User kept switching, abandon this event
                        break
                    time.sleep(0.1) # Check every 100ms
                
                # If window is stable and still different from the last logged one
                if is_stable and current != last_window:
                   # It's a real focused app event
                   
                   # 1. Learn (Update Transition Matrix)
                   # "User went from Last -> Current"
                   if last_window: brain.learn(last_window, current)
                   
                   # 2. Log to DB & Predict Next Move
                   log_and_predict(current)
                   
                   # Update state
                   last_window = current
            
            time.sleep(0.5) # Poll every 500ms (Low CPU usage)
            
        except KeyboardInterrupt:
            break # Exit on Ctrl+C
        except Exception as e:
            print(f"[ERROR] Loop: {e}")
            time.sleep(1) # Wait before retrying on error

if __name__ == "__main__":
    main()

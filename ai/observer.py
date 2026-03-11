import time         # Used for sleep (debouncing) and timestamps
import sqlite3      # Used to log activity to local database
import os           # Used for file path resolution
import psutil       # (Unused import, but typically used for process management)
import json         # Used to format output as JSON
import ctypes       # Used to call Windows API (User32.dll)
import subprocess   # Used to run PowerShell to get installed apps
from brain_vomm import BrainVOMM # Import our new Variable-Order Markov Model

# CACHE for installed applications to prevent checking every time
INSTALLED_APPS_CACHE = set()

# CONFIGURATION
# Resolve absolute path to the SQLite database
DB_PATH = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')
DEBOUNCE_SECONDS = 1.5 # Only log if window stays open/focused for 1.5s
# List of window titles to ignore (system hidden windows)
IGNORE_LIST = ["Task Switching", "Program Manager", "Windows Input Experience", ""]

# Initialize the Brain (Variable-Order Markov Model)
brain = BrainVOMM(max_order=5)

def init_db():
    global INSTALLED_APPS_CACHE
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
        
        # Build Installed Apps Cache once at startup
        print("[INFO] Building Installed Apps Cache...")
        try:
            # Run powershell command
            result = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Get-StartApps | Select-Object -ExpandProperty Name"],
                capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW
            )
            # Add results to set 
            if result.stdout:
                apps = result.stdout.splitlines()
                for app in apps:
                    if app.strip():
                        INSTALLED_APPS_CACHE.add(app.strip().lower())
                
                # Add some critical manual fallbacks
                INSTALLED_APPS_CACHE.add("google chrome")
                INSTALLED_APPS_CACHE.add("microsoft edge")
                INSTALLED_APPS_CACHE.add("visual studio code")
                INSTALLED_APPS_CACHE.add("diva assistant") # Fake app so it doesn't get filtered out
                INSTALLED_APPS_CACHE.add("spotify")
                INSTALLED_APPS_CACHE.add("calculator")
                INSTALLED_APPS_CACHE.add("notepad")
                INSTALLED_APPS_CACHE.add("file explorer")
        except Exception as e:
            print(f"[WARN] Failed to load app cache: {e}")
            
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
        # Ask the advanced VOMM brain what context matches we have
        prediction = brain.predict()
        if prediction:
            next_action = prediction.get("next_action")
            
            # --- VALIDATION LAYER ---
            # Verify the suggested "next_action" is actually a real, installed app
            # (or the user's DIVA window itself) before sending the suggestion
            if next_action and INSTALLED_APPS_CACHE:
                 next_action_lower = str(next_action).lower().strip()
                 
                 # Attempt fuzzy check natively first to bypass latency of python libraries like fuzzywuzzy
                 is_installed = False
                 for cached_app in INSTALLED_APPS_CACHE:
                     if next_action_lower in cached_app or cached_app in next_action_lower:
                         is_installed = True
                         break
                         
                 if not is_installed:
                     print(f"[PREDICTION] Filtered out uninstalled app: '{next_action}'")
                     return # Abort sending this prediction if it's garbage

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
                   # VOMM learns the current state inherently mapping it to the history buffer
                   brain.learn(current)
                   
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

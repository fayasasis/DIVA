import sqlite3       # Database access
import os            # File path handling
from collections import defaultdict # Dictionary subclass that calls a factory function to supply missing values
import json          # JSON manipulation

class BrainHMM:
    """
    first-Order Hidden Markov Model (HMM) for App Prediction.
    
    Logic:
    - Calculates the probability of moving from App A -> App B.
    - Stores counts in a Transition Matrix.
    - Probability = (Count A->B) / (Total transitions from A)
    """

    def __init__(self):
        # Matrix: { 'current_app': { 'next_app': count } }
        # Example: { 'Visual Studio Code': { 'Google Chrome': 10, 'Spotify': 2 } }
        self.transition_matrix = defaultdict(lambda: defaultdict(int))
        
        # Total counts for each source app (Normalization factor)
        self.total_counts = defaultdict(int) 
        
        # Path to the shared SQLite database
        self.db_path = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')

    def load_data(self):
        """Load historical logs from DB and rebuild the Transition Matrix."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Simple 1st Order logic: Order by time ascending
            cursor.execute("SELECT action_value FROM activity_logs WHERE action_type='APP_FOCUS' ORDER BY timestamp ASC")
            rows = cursor.fetchall()
            conn.close()
            
            # Extract just the app names
            actions = [row[0] for row in rows]
            
            # Re-Learn from history
            # Loop through history and simulate the learning process
            for i in range(len(actions) - 1):
                current = self.normalize(actions[i])
                next_act = self.normalize(actions[i+1])
                self.learn(current, next_act)
                
            print(f"[BRAIN] Trained on {len(actions)} historical actions.")
        except Exception as e:
            print(f"[ERROR] Brain Load Failed: {e}")

    def normalize(self, title):
        """Standardize app titles (Duplicates Observer logic for consistency)."""
        if not title: return None
        if "Visual Studio Code" in title or "VS Code" in title: return "Visual Studio Code"
        if "Google Chrome" in title or "Chrome" in title: return "Google Chrome"
        if "Microsoft Edge" in title or "Edge" in title: return "Microsoft Edge"
        if "Spotify" in title: return "Spotify"
        if "Calculator" in title: return "Calculator"
        if "Notepad" in title: return "Notepad"
        if "DIVA" in title: return "DIVA Assistant"
        return title.split(' - ')[-1]

    def learn(self, from_action, to_action):
        """Update probability matrix with a new transition event."""
        if from_action and to_action and from_action != to_action:
            # Increment the count for this specific pair (A -> B)
            self.transition_matrix[from_action][to_action] += 1
            
            # Increment the total count for the source (A)
            self.total_counts[from_action] += 1
            # print(f"[LEARN] {from_action} -> {to_action}")

    def predict(self, current_action):
        """
        Return the next most likely action based on the current one.
        Returns None if no confident prediction exists.
        """
        # If we have never seen this app before, we can't predict
        if current_action not in self.transition_matrix:
            return None
            
        transitions = self.transition_matrix[current_action]
        # If no outgoing transitions recorded
        if not transitions:
            return None
            
        # Get best candidate (the one with the highest count)
        likely_next = max(transitions, key=transitions.get)
        
        count = transitions[likely_next]       # How many times A->B happened
        total = self.total_counts[current_action] # How many times A->Anything happened
        
        # Calculate probability (Confidence)
        confidence = count / total if total > 0 else 0.0
        
        # Threshold: Only predict if confidence > 30%
        if confidence > 0.3:
            return {
                "type": "suggestion",
                "current_action": current_action,
                "next_action": likely_next,
                "confidence": round(confidence, 2),
                "reason": f"Followed {count} times"
            }
        return None

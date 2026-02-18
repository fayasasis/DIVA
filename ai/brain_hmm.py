import sqlite3
import os
from collections import defaultdict
import json

class BrainHMM:
    def __init__(self):
        # Matrix: { 'current_app': { 'next_app': count } }
        self.transition_matrix = defaultdict(lambda: defaultdict(int))
        self.total_counts = defaultdict(int) 
        self.db_path = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')

    def load_data(self):
        """Load logs from DB and build the Transition Matrix."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Simple 1st Order: Order by time
            cursor.execute("SELECT action_value FROM activity_logs WHERE action_type='APP_FOCUS' ORDER BY timestamp ASC")
            rows = cursor.fetchall()
            conn.close()
            
            actions = [row[0] for row in rows]
            
            # Build Matrix
            for i in range(len(actions) - 1):
                current = actions[i]
                next_act = actions[i+1]
                self.learn(current, next_act)
                
            print(f"[BRAIN] Trained on {len(actions)} historical actions.")
        except Exception as e:
            print(f"[ERROR] Brain Load Failed: {e}")

    def learn(self, from_action, to_action):
        """Update probability matrix in real-time."""
        if from_action and to_action and from_action != to_action:
            self.transition_matrix[from_action][to_action] += 1
            self.total_counts[from_action] += 1
            # print(f"[LEARN] {from_action} -> {to_action}")

    def predict(self, current_action):
        """Return the next most likely action."""
        if current_action not in self.transition_matrix:
            return None
            
        transitions = self.transition_matrix[current_action]
        if not transitions:
            return None
            
        # Get best candidate
        likely_next = max(transitions, key=transitions.get)
        count = transitions[likely_next]
        total = self.total_counts[current_action]
        confidence = count / total if total > 0 else 0.0
        
        # Threshold (e.g., 30% confidence minimum)
        if confidence > 0.3:
            return {
                "type": "suggestion",
                "current_action": current_action,
                "next_action": likely_next,
                "confidence": round(confidence, 2),
                "reason": f"Followed {count} times"
            }
        return None

import sqlite3
import os
import time
from collections import defaultdict

class TrieNode:
    """A node in the context Suffix Tree."""
    def __init__(self):
        # Maps the next specific app the user switched to => Count
        self.transitions = defaultdict(int)
        
        # Maps previous app in the sequence back further into history
        # (This builds the "Suffix" memory tree backwards)
        self.children = defaultdict(TrieNode)
        
        # Total transitions outbound from this specific context length
        self.total_count = 0

class BrainVOMM:
    """
    Variable-Order Markov Model (VOMM) for App Prediction.
    
    Instead of only looking at the LAST app, it maintains a buffer of recent history 
    and checks if it can match longer context chains (e.g. A->B->C) before
    falling back to shorter ones (B->C or just C).
    """

    def __init__(self, max_order=5):
        self.max_order = max_order
        self.root = TrieNode() # The 0-order base node
        self.history_buffer = [] # Tracks the user's most recent N actions in real-time
        
        self.db_path = os.path.join(os.path.dirname(__file__), '../backend/database.sqlite')

        # --- ANTI-SPAM: Cooldown & Repeat Suppression ---
        self._last_suggested_app = None
        self._last_suggestion_time = 0
        self.suggestion_cooldown = 120  # 2 minutes

        # --- QUALITY GATE: Minimum sample size ---
        self.min_samples = 5

        # --- CONFIDENCE THRESHOLDS (raised from original) ---
        self.confidence_thresholds = {
            1: 0.60,
            2: 0.45,
            3: 0.35,
            4: 0.28,
            5: 0.25,
        }

    def load_data(self):
        """Rebuild the exact state of the VOMM Trie from historical DB logs."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT action_value FROM activity_logs WHERE action_type='APP_FOCUS' ORDER BY timestamp ASC")
            rows = cursor.fetchall()
            conn.close()
            
            actions = [row[0] for row in rows]
            
            self.history_buffer = []
            for action in actions:
                norm_action = self.normalize(action)
                if norm_action:
                    self.learn(norm_action)
                    
            print(f"[BRAIN] VOMM Trained on {len(actions)} historical events (Max Order {self.max_order}).")
        except Exception as e:
            print(f"[ERROR] VOMM Load Failed: {e}")

    def normalize(self, title):
        """Standardize app titles."""
        if not title: return None
        if "Visual Studio Code" in title or "VS Code" in title: return "Visual Studio Code"
        if "Google Chrome" in title or "Chrome" in title: return "Google Chrome"
        if "Microsoft Edge" in title or "Edge" in title: return "Microsoft Edge"
        if "Spotify" in title: return "Spotify"
        if "Calculator" in title: return "Calculator"
        if "Notepad" in title: return "Notepad"
        if "diva" in title.lower(): return "DIVA Assistant"
        return title.split(' - ')[-1]

    def _update_trie(self, context_sequence, next_action):
        """
        Recursively updates the Trie with suffix patterns.
        Given history [A, B, C] and next D:
        Updates root with D.
        Updates Node(C) with D.
        Updates Node(C)->Node(B) with D.
        Updates Node(C)->Node(B)->Node(A) with D.
        """
        self.root.transitions[next_action] += 1
        self.root.total_count += 1
        
        node = self.root
        
        for item in reversed(context_sequence):
            node = node.children[item]
            node.transitions[next_action] += 1
            node.total_count += 1

    def learn(self, current_action):
        """Records an event, updating all variable-order lengths, and adds to history buffer."""
        if not current_action: return
        
        if self.history_buffer:
            if current_action == self.history_buffer[-1]:
                return
                
            self._update_trie(self.history_buffer, current_action)
            
        self.history_buffer.append(current_action)
        
        if len(self.history_buffer) > self.max_order:
            self.history_buffer.pop(0)

    def predict(self):
        """
        Finds the longest matching context in the Trie that passes the confidence threshold,
        minimum sample size, cooldown, and repeat suppression gates.
        Gracefully falls back to shorter contexts (Variable Order).
        """
        if not self.history_buffer:
            return None

        # --- ANTI-SPAM: Cooldown check ---
        now = time.time()
        if (now - self._last_suggestion_time) < self.suggestion_cooldown:
            return None

        for order_length in range(len(self.history_buffer), 0, -1):
            
            context_slice = self.history_buffer[-order_length:]
            
            node = self.root
            valid_path = True
            
            for item in reversed(context_slice):
                if item not in node.children:
                    valid_path = False
                    break
                node = node.children[item]
                
            if not valid_path or not node.transitions:
                continue

            # --- QUALITY GATE: Minimum sample size ---
            if node.total_count < self.min_samples:
                continue

            likely_next = max(node.transitions, key=node.transitions.get)
            count = node.transitions[likely_next]
            total = node.total_count
            
            confidence = count / total if total > 0 else 0.0

            min_confidence = self.confidence_thresholds.get(order_length, 0.25)
            
            if confidence >= min_confidence:

                # --- ANTI-SPAM: Don't suggest the same app twice in a row ---
                if likely_next == self._last_suggested_app:
                    continue

                # Don't suggest the app the user is already in
                if likely_next == self.history_buffer[-1]:
                    continue

                # Don't suggest DIVA suggesting itself (case-insensitive)
                if "diva" in likely_next.lower() or likely_next.lower() == "diva assistant":
                    continue

                # All gates passed — fire the suggestion
                self._last_suggested_app = likely_next
                self._last_suggestion_time = now

                context_str = " -> ".join(context_slice)
                return {
                    "type": "suggestion",
                    "current_context": context_slice,
                    "next_action": likely_next,
                    "confidence": round(confidence, 2),
                    "order_used": order_length,
                    "reason": f"VOMM(Order {order_length}): Saw '{context_str}' followed by '{likely_next}' {count}/{total} times"
                }

        return None
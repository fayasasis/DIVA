# DIVA System Architecture (Phase 1: Text-to-Action)
**Date:** February 2026
**Status:** Stable Prototype
**Version:** 0.5 (Text Only)

## 1. System Overview
DIVA is a modular Desktop Virtual Assistant designed to execute local system commands based on natural language input. The system currently follows a **3-Tier Architecture**:

1.  **Frontend (The Face):** A React-based UI for user interaction.
2.  **Backend (The Heart):** A Node.js server for routing and logic.
3.  **Services (The Limbs):** Specialized modules for AI processing and System Automation.

---

## 2. Directory Structure & File Manifest

The project is refactored into four distinct domains to ensure separation of concerns.

### 📂 /frontend (User Interface)
*Built with: React, Vite, Axios*

| File | Purpose |
| :--- | :--- |
| `src/App.jsx` | **Main Logic Controller.** Manages chat state, handles user input, and communicates with the Backend via HTTP POST. |
| `src/App.css` | **Styling.** Implements the "Dark Mode" aesthetic, glass-morphism chat bubbles, and responsive layout. |
| `src/main.jsx` | **Entry Point.** Bootstraps the React application into the DOM. |

### 📂 /backend (Server Layer)
*Built with: Node.js, Express, Socket.io*

| File | Purpose |
| :--- | :--- |
| `server.js` | **Central Hub.** Listens on Port 5000. It receives requests from Frontend, routes them to `ai/` for intent classification, then to `automation/` for execution, and returns the result. |

### 📂 /ai (Intelligence Layer)
*Built with: Custom Logic (Migration to Ollama/Vosk planned)*

| File | Purpose |
| :--- | :--- |
| `dummyLLM.js` | **Rule-Based Brain.** A temporary lightweight logic engine. It uses keyword matching (e.g., "open", "notepad") to classify user intent. Serves as a placeholder for the real LLM. |

### 📂 /automation (Execution Layer)
*Built with: Node.js Child Process*

| File | Purpose |
| :--- | :--- |
| `actionHandler.js`| **System Bridge.** Receives structured commands (JSON) and executes native Windows shell commands (e.g., `start "" "notepad"`) to launch applications. |

---

## 3. Data Flow Diagram

**Scenario:** User types "Open Notepad"

1.  **Input:** User types "Open Notepad" in `App.jsx`.
2.  **Transport:** Frontend sends POST request to `http://localhost:5000/chat`.
3.  **Analysis:** `server.js` passes text to `dummyLLM.js`.
    * *Result:* `{ type: "system_action", intent: "open_app", app: "notepad" }`
4.  **Execution:** `server.js` passes the intent to `actionHandler.js`.
5.  **System Call:** `actionHandler.js` executes `start "" "notepad"` via Windows Command Line.
6.  **Response:** Backend sends "I have opened Notepad" back to Frontend.
7.  **Display:** `App.jsx` renders the bot's response in the chat window.

---

## 4. Current Capabilities
As of Phase 1, the system supports:

* **Chat Interface:** Persistent chat history within the session.
* **Intent Recognition:** Can distinguish between "Conversation" and "System Commands."
* **App Launching:** Native support for:
    * Notepad
    * Google Chrome
    * Calculator
    * VS Code
    * (And any app in the System Path)

## 5. Future Roadmap (Immediate)
* [ ] **Phase 2:** Voice Integration (Vosk Model).
* [ ] **Phase 3:** True AI Integration (Ollama LLM).
* [ ] **Phase 4:** Long-term Memory (MongoDB).
# DIVA System Architecture (Voice & Intelligence)
**Date:** February 2026
**Version:** (Voice + Local AI)

## 1. System Overview
DIVA is a modular, offline-first Desktop Virtual Assistant capable of hearing, thinking, and acting on system commands. The system now follows a **Hybrid 4-Tier Architecture**:

1.  **Frontend (The Face):** React UI with Web Speech API for Text-to-Speech (TTS).
2.  **Backend (The Heart):** Node.js server using Socket.io for real-time bi-directional communication.
3.  **Intelligence (The Brain & Ears):** * **AI:** Local LLM (Phi-3 Mini via Ollama) for context understanding.
    * **Voice:** Python + Vosk for offline speech recognition.
4.  **Automation (The Hands):** Node.js Child Processes executing PowerShell & Shell commands.

---

## 2. Directory Structure & File Manifest

### 📂 /frontend (User Interface)
*Built with: React, Vite, Socket.io-client*

| File | Purpose |
| :--- | :--- |
| `src/App.jsx` | **Controller.** Handles mic toggle, receives Socket events (`bot_response`), and executes Text-to-Speech (`window.speechSynthesis`). |
| `src/App.css` | **Styling.** Includes visual indicators for "Listening" state and responsive chat layout. |

### 📂 /backend (Server Layer)
*Built with: Node.js, Express, Socket.io*

| File | Purpose |
| :--- | :--- |
| `server.js` | **Central Nervous System.** Manages WebSocket connections. Routes voice data from Python -> Ollama -> Automation -> Frontend. |

### 📂 /ai (Intelligence Layer)
*Built with: Python, Vosk, Ollama (Phi-3)*

| File | Purpose |
| :--- | :--- |
| `ollamaService.js`| **The Brain.** Connects to local Ollama instance (Port 11434). Uses a system prompt to force Phi-3 to output strict JSON for automation. |
| `voiceService.js` | **The Ear Manager.** A Node.js wrapper that spawns and manages the Python listening script. |
| `ears.py` | **The Actual Ears.** A Python script using `vosk` and `sounddevice`. Listens to the microphone and prints recognized text to STDOUT. |
| `model/` | **Vosk Model.** Local offline dictionary for speech-to-text. |

### 📂 /automation (Execution Layer)
*Built with: Node.js Child Process (Spawn/Exec)*

| File | Purpose |
| :--- | :--- |
| `actionHandler.js`| **The Muscles.** Executes system commands. Uses `powershell` for volume/media controls and detached `spawn` processes for launching apps without hanging the server. |

---

## 3. Data Flow Diagram (The "Magic" Loop)

**Scenario:** User says "Turn the volume up"

1.  **Input (Voice):** User speaks into the microphone.
2.  **Transcription:** `ears.py` (Python) captures audio, converts to text ("turn volume up"), and prints it.
3.  **Transport:** `server.js` reads the text and pushes it to `ollamaService.js`.
4.  **Thinking:** `ollamaService.js` sends text to **Phi-3 Mini**.
    * *Result:* `{ "type": "system_action", "intent": "system_control", "entities": { "app": "volume up" } }`
5.  **Execution:** `actionHandler.js` receives the intent and runs PowerShell:
    * `$ws.SendKeys([char]175 * 5)` (Simulates Key Press).
6.  **Response:** Backend emits a socket event `bot_response: "Turning volume up"`.
7.  **Output (Speech):** `App.jsx` receives the text and uses the browser's voice to speak it aloud.

---

## 4. Current Capabilities (v0.9)

### 🗣️ Voice & Interaction
* **Offline Wake/Sleep:** Push-to-talk microphone control.
* **Text-to-Speech:** DIVA speaks responses back to the user.
* **Contextual Chat:** Can answer general questions ("Tell me a joke") using Phi-3.

### 🦾 System Automation
* **App Launching:** Notepad, Chrome, Calculator, VS Code, etc.
* **Media Control:** Volume Up/Down, Mute.
* **Security:** Lock Screen.
* **Web Search:** "Google [query]" opens Chrome with results.

---
Already done
* [x] **Phase 1:** Basic Text-to-Action.
* [x] **Phase 2:** Voice Integration (Vosk).
* [x] **Phase 3:** True AI (Ollama/Phi-3).
* [x] **Phase 4:** System Controls (PowerShell).
* [ ] **Phase 5:** Long-term Memory (Database/JSON Storage).

## 5. Future Roadmap
* [x] **Phase 1:** Basic Text-to-Action.
* [x] **Phase 2:** Voice Integration (Vosk).
* [x] **Phase 3:** True AI (Ollama/Phi-3).
* [x] **Phase 4:** System Controls (PowerShell).
* [ ] **Phase 5:** Long-term Memory (Database/JSON Storage).
* [ ] **Phase 6:** Computer Vision (See the screen).
* [ ] **Phase 7:** Wake Word Detection ("Hey DIVA").
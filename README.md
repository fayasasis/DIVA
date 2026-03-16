# DIVA (Desktop Intelligent Virtual Assistant)

DIVA is an advanced, locally-hosted AI assistant designed to automate system tasks, learn from user behavior, and improve desktop productivity. It leverages large language models (via Ollama) and machine learning (VOMM - Variable-Order Markov Models) to understand natural language intents and anticipate your next actions.

## 🌟 Key Features

* **Natural Language Control:** Control your PC using everyday language (e.g., *"Open Chrome"*, *"Volume up"*, *"Delete the test folder"*).
* **Multi-Modal Interaction:** Supports both text input and hands-free **Voice Commands** with local speech-to-text.
* **Contextual Memory (Semantic Cache):** DIVA remembers successful commands and your conversational history, making follow-ups natural ("What did I just ask?").
* **Smart App Prediction:** A background observer monitors window focus habits and uses a machine-learning Brain (VOMM) to suggest which app you might need next.
* **Local & Private:** Powered primarily by a local AI instance (Ollama), keeping your queries and activity data safe on your machine.
* **Safe Mode:** Potentially destructive actions (like shutting down or deleting files) require explicit user confirmation.

## 🏗️ Architecture Stack

DIVA is built using a modern, multi-process architecture:

1. **Frontend (React + Tailwind + Vite):**
   * A sleek, transparent, "always-on-top" UI that resembles a futuristic HUD.
   * Manages state, chat history rendering, and Text-to-Speech (TTS) audio generation.
   * Communicates with the backend via REST APIs and WebSockets.

2. **Backend Server (Node.js + Express + Socket.IO):**
   * The central nervous system of DIVA.
   * **Database:** Uses SQLite (via Sequelize) to manage `Sessions`, `Chats`, and the `Semantic Cache`.
   * **Automation Router:** Parses AI intents and routes them to specific modules (`appControl`, `fileControl`, `systemControl`, `webControl`).
   * **AI Integrations:** Connects to the local Ollama API to process user prompts and generate intelligent responses.

3. **Desktop Wrapper (Electron):**
   * Packages the web frontend into a native Windows application.
   * Manages system tray integration, global shortcuts, window transparency, and bridging backend events to the frontend UI.

4. **AI & Machine Learning (Python):**
   * `observer.py`: A background service that hooks into the Windows API to monitor active windows.
   * `brain_vomm.py`: Analyzes the observer's logs to learn user habits and predict the next application switch.
   * `ears.py`: Utilizes local voice recognition models (Vosk) to transcribe microphone input into text.

## ⚙️ Core Automation Modules

DIVA executes real-world tasks using native OS scripts (primarily PowerShell on Windows) across several domains:

* **File Control:** Create, delete, list, rename, and group files/folders intelligently using contextual path resolution (e.g., understands words like "Downloads" or "Desktop"). Handles multiple targets simultaneously.
* **System Control:** Manage volume, brightness, lock screen, sleep, and power options.
* **App & Window Control:** Launch, terminate, and restart installed applications using fuzzy-matching to ensure high reliability. Manage window states (minimize, maximize, focus).
* **Web Control:** Perform Google searches, navigate to specific websites, and control media playback (Spotify/YouTube).

## 🚀 Getting Started

1. **Prerequisites:**
   * Node.js & npm
   * Python (with required libraries: `psutil`, `pyaudio`, `vosk`, etc.)
   * Ollama installed and running locally with the `phi3` model (and `nomic-embed-text` for semantic caching).

2. **Running the App:**
   From the root project directory (`DIVA`), execute:
   ```bash
   npm start
   ```
   This `concurrently` starts the Vite dev server for the frontend, the Node backend, and the Electron wrapper.

---
*DIVA: Making your desktop smarter, one command at a time.*

# DIVA (Desktop Intelligent Virtual Assistant) - Project Blueprint & Workflow
**Document Generated for AI Architecture Visualization**
**Date:** 2026-02-19
**Version:** 2.0 (Electron Hybrid System)

This document provides a highly detailed, component-level breakdown of the DIVA system for the purpose of creating architectural diagrams and visualizations.

---

## 1. Project Identity & Core Concept

*   **Name:** DIVA (Desktop Intelligent Virtual Assistant)
*   **Concept:** A **User-Centric Operating System Overlay**. Not just a chatbot, but a "second brain" that lives on top of Windows. It observes user behavior, predicts needs, and executes complex system commands via natural language or proactive suggestions.
*   **Metaphor:**
    *   **The Brain (Node.js + Llama 3):** Determines intent and logic.
    *   **The Eyes (Python Observer):** Watches the screen and user activity.
    *   **The Ears (Python Vosk):** Listens for commands.
    *   **The Hands (PowerShell Automation):** Manipulates windows, files, and settings.
    *   **The Face (React + Electron):** Interact with the user via specific UI (Dashboard & Overlay).

---

## 2. Technology Stack (The Building Blocks)

### **Frontend (The Interface)**
*   **Framework:** **React (Vite)**
    *   *Role:* Dynamic, high-performance UI rendering.
*   **Styling:** **Tailwind CSS**
    *   *Role:* "Cyberpunk/Futuristic" aesthetic (Neon Cyan, Dark Mode, Glassmorphism).
*   **Routing:** **React Router (HashRouter)**
    *   *Role:* Manages views within the Electron environment (`/` for Dashboard, `/overlay` for Predictions).
*   **Communication:** **Socket.IO Client** & **Electron IPC Renderer**
    *   *Role:* Real-time bi-directional data flow.

### **Desktop Shell (The Container)**
*   **Core:** **Electron**
    *   *Role:* Wraps the web app into a native Windows executable.
*   **Process Manager:** **Node.js (Main Process)**
    *   *Role:* Orchestrator. Spawns and manages the lifecycle of the Backend Server and Python Microservices.
*   **Bridge:** **Context Isolation & Preload Scripts**
    *   *Role:* Securely exposes native capabilities (IPC) to the React Frontend.

### **Backend (The Logic Hub)**
*   **Runtime:** **Node.js**
*   **Framework:** **Express.js**
    *   *Role:* REST API processing and static file serving.
*   **Database:** **SQLite (via Sequelize ORM)**
    *   *Role:* Local, persistent storage for Chat History (`chats` table), User Sessions (`sessions` table), and Activity Logs (`activity_logs` table).
*   **AI Integration:** **Ollama (Llama 3)**
    *   *Role:* Local Large Language Model for Natural Language Understanding (Intent Classification & entity extraction).
*   **Real-time:** **Socket.IO Server**
    *   *Role:* Pushes updates (Observer data, text responses) to the Frontend instantly.

### **Intelligence Layer (The AI Microservices)**
*   **Language:** **Python 3**
*   **Window Tracking:** **ctypes (Win32 API)**
    *   *Role:* High-frequency, low-latency polling of the active window title.
*   **Prediction Engine:** **Hidden Markov Model (HMM)**
    *   *Role:* Implementation of a 1st-Order Markov Chain. Learns transition probabilities (e.g., "After VS Code, 80% chance user opens Chrome").
*   **Speech Recognition:** **Vosk (Offline)**
    *   *Role:* Privacy-focused, offline voice-to-text processing.

### **Automation Layer (The Executioner)**
*   **Scripting:** **PowerShell**
    *   *Role:* Deep Windows integration. Used to start processes, switch windows, change settings (volume/brightness), and manage files.
*   **Wrapper:** **Node.js `child_process.spawn`**
    *   *Role:* Invokes PowerShell commands dynamically based on AI decisions.

---

## 3. Workflows & Data Pipelines (Step-by-Step)

### **Workflow A: System Startup (The "Big Bang")**
1.  **User** launches `DIVA.exe` (or runs `npm start`).
2.  **Electron (Main Process)** initializes.
3.  **Electron** spawns **Node.js Server** (Port 5000) as a child process.
    *   *Constraint:* Server must be ready before UI loads data.
4.  **Electron** spawns **Python Observer** (`observer.py`) as a child process.
5.  **Electron** creates two browser windows:
    *   **Main Window (Dashboard):** Loads `index.html#/`. Visible by default.
    *   **Overlay Window (Floating):** Loads `index.html#/overlay`. Hidden, Transparent, Always-on-Top, No Taskbar Icon.
6.  **React Frontend** mounts and connects to the **Socket.IO Server**.

### **Workflow B: The Prediction Loop (The "Mind Reader")**
1.  **User** switches focus to an application (e.g., "Spotify").
2.  **Observer (Python)** detects the change via `ctypes.GetForegroundWindow()`.
3.  **Observer** normalizes the title (e.g., "Spotify Free" -> "Spotify").
4.  **Observer** logs this transition to **SQLite** (`activity_logs`).
5.  **Brain (HMM)** calculates the probability of the *next* likely app based on history.
    *   *Example:* `P(VS Code | Spotify) = 0.85`
6.  **Observer** emits a JSON packet to `stdout`: 
    *   `JSON_PREDICTION: { "current": "Spotify", "next": "Visual Studio Code", "confidence": 0.85 }`
7.  **Electron (Main Process)** reads this via `stdout.on('data')`.
8.  **Electron Routing Logic:**
    *   *IF* Main Window is focused: Send prediction to Dashboard via IPC.
    *   *IF* Main Window is backgrounded: Show **Overlay Window** and send prediction there.
9.  **React UI** renders a "Suggestion Pill": "Open VS Code?"
10. **User** clicks "Accept".
11. **React** calls Backend API: `POST /api/execute-prediction`.
12. **Backend** calls **Automation Module**.
13. **Automation** runs PowerShell: `Switch-Process` or `Start-Process`.
14. **OS** switches focus to VS Code.

### **Workflow C: Voice Command (The "Commander")**
1.  **User** says "Open Notepad".
2.  **Microphone** captures audio.
3.  **Python (Ears)** processes audio stream via **Vosk Model**.
4.  **Python** emits text: `RECOGNIZED: open notepad`.
5.  **Node (VoiceService)** captures this text.
6.  **Node** emits Socket event: `voice_command` -> `open notepad`.
7.  **Server** treats this text as if it was typed in Chat.
8.  **Server** -> **Ollama**: "Classify Intent: 'open notepad'".
9.  **Ollama**: Returns `{ intent: "open_app", entities: { name: "notepad" } }`.
10. **Server** -> **Automation**: `executeAction("open_app", "notepad")`.
11. **Automation** -> **PowerShell**: Starts Notepad.
12. **Server** -> **Frontend**: Speaks Response "Opening Notepad" (TTS).

### **Workflow D: Text Chat & Context (The "Conversation")**
1.  **User** types: "Why is the sky blue?".
2.  **React** sends `POST /chat`.
3.  **Server** retrieves last 10 messages from **SQLite** (Session Context).
4.  **Server** constructs a prompt with: System Instructions + Recent Chat History + New Question.
5.  **Server** -> **Ollama**: Streams the response token-by-token.
6.  **Frontend** updates the UI in real-time.
7.  **Server** saves the user query and the full AI response to **SQLite**.

---

## 4. Visual Metaphors for AI Image Generation
If creating a diagram, use these concepts:

*   **Central Hub:** A glowing Node.js logo or Server icon, pulsating with connections.
*   **The Shell:** An Electron atom encasing the Node.js Hub and the React UI.
*   **The Satellite:** A small Python logo orbiting the shell, scanning with a "radar" beam (The Observer).
*   **The Bridge:** Glowing data lines (IPC) connecting the Python Satellite to the Electron Core.
*   **The user:** A silhouette interacting with a floating holographic interface (React).
*   **The Engine:** Gears or pistons representing PowerShell, driven by the Node.js Hub.
*   **The Library:** A stack of books (SQLite) connected to the Brain (Ollama) and the Hub.

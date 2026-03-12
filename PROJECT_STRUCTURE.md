# DIVA Project Structure & File Directory

This document provides a comprehensive overview of the DIVA (Desktop Intelligent Virtual Assistant) project hierarchy, explaining the role and purpose of each directory and key file.

## 1. Project Tree Overview

```text
e:\DIVA\
├── ai/                       # Intelligence & Voice Microservices
├── automation/               # System Control & Execution Layer
├── backend/                  # Orchestration & Data Hub (Node/Express)
├── docs/                     # Project Documentation & Architecture
├── electron/                 # Desktop Shell Container
├── frontend/                 # React-based User Interface
├── node_modules/             # Project Dependencies (Root)
├── .gitignore                # Git exclusion rules
├── LICENSE                   # Licensing information
├── package.json              # Main project configuration
├── package-lock.json         # Dependency lock file
├── README.md                 # Basic project intro
└── requirements.txt          # Python dependencies
```

---

## 2. Component Deep-Dive

### 📂 `ai/`
Contains the AI logic, voice recognition, and system observer.

| File/Folder | Purpose |
|:---|:---|
| `model/` | Contains the Vosk speech-to-text model files. |
| `brain_hmm.py` | (Legacy) Hidden Markov Model implementation for activity prediction. |
| `brain_vomm.py` | Variable-Order Markov Model used for predicting user actions based on window focus. |
| `ears.py` | Microphone listener using Vosk; converts speech to text (STT). |
| `observer.py` | System watcher that tracks active windows and provides real-time predictions. |
| `ollamaService.js` | Node utility to interact with the local Ollama LLM (Llama 3 / Phi3). |
| `voiceService.js` | Electron-side bridge that manages the Python `ears.py` process. |

### 📂 `automation/`
The "hands" of the assistant, used to execute commands on the Windows OS.

| File/Folder | Purpose |
|:---|:---|
| `modules/` | Specific control scripts (App, Window, Web, System, File, Note). |
| `utils/` | Shared utilities like PowerShell runners and fuzzy matchers. |
| `index.js` | Central entry point for all system actions; routes intents to modules. |

#### 📂 `automation/modules/`
Detailed control logic:
- `appControl.js`: Opens, closes, and focuses Windows applications.
- `fileControl.js`: Manages file and folder creation or deletion.
- `noteControl.js`: Simple note-taking and reminder logic.
- `systemControl.js`: Adjusts volume, brightness, and power states.
- `webControl.js`: Handles URL opening, web searches, and media controls.
- `windowControl.js`: Minimizes, maximizes, or switches between active windows.

### 📂 `backend/`
The bridge between the AI, Automation, and the Frontend.

| File/Folder | Purpose |
|:---|:---|
| `config/` | Database configuration (Sequelize/SQLite). |
| `models/` | Database table definitions (Chat, Session, SemanticCache, Note). |
| `utils/` | Backend helpers, including Ollama embedding logic (`embedding.js`). |
| `server.js` | The main Node/Express/Socket.IO server; coordinates all requests. |
| `database.sqlite` | Local database file storing history and cache. |
| `seedCache.js` | Script to pre-populate the semantic cache with common commands. |

### 📂 `electron/`
The native desktop container for DIVA.

| File/Folder | Purpose |
|:---|:---|
| `main.js` | Electron's main process; handles window creation, IPC, and child processes. |

### 📂 `frontend/`
The visual "face" of DIVA, built with React and Vite.

| File/Folder | Purpose |
|:---|:---|
| `src/` | Main source code (React components, App logic, styles). |
| `public/` | Static assets (icons, etc.). |
| `index.html` | Base HTML template for the UI. |
| `vite.config.js` | Configuration for the Vite build tool. |
| `tailwind.config.cjs` | Styling configuration for Tailwind CSS. |

#### 📂 `frontend/src/`
- `App.jsx`: The primary dashboard and chat interface.
- `Overlay.jsx`: The transparent popup for pro-active predictions.
- `components/SettingsModal.jsx`: User configuration interface.

### 📂 `docs/`
Internal documentation for developers and AI assistants.

| File/Folder | Purpose |
|:---|:---|
| `SYSTEM_ARCHITECTURE.md` | Deep dive into how data flows through the system. |
| `PROJECT_BLUEPRINT_FOR_AI.md` | Condensed context for AI agents working on DIVA. |
| `SETUP_GUIDE.md` | Instructions for installing and running the project. |

---

## 3. Key Configuration Files

- `package.json` (Root): Defines how Electron and the Backend start together.
- `requirements.txt`: Necessary for running the Python components (`psutil`, `sounddevice`, `vosk`).
- `.gitignore`: Ensures large files like `node_modules` and the `database.sqlite` (optionally) aren't committed to Git.

# DIVA - Complete Installation & Setup Guide

Welcome to **DIVA (Desktop Intelligent Virtual Assistant)**. This comprehensive guide will walk you through setting up the complete development environment on your local machine after pulling the repository.

DIVA consists of an Electron app shell, a React/Vite frontend, a Node.js/Express backend, and a Python AI service. Therefore, it requires both Node.js and Python environments, as well as offline AI models.

## 1. System Requirements

Before you begin, ensure you have the following installed:

*   **Node.js**: Version 18.0.0 or higher. [Download Here](https://nodejs.org/)
*   **Python**: Version 3.10 or higher. [Download Here](https://www.python.org/)
    *   *Note: Ensure "Add Python to PATH" is checked during installation.*
*   **Git**: For cloning the repository. [Download Here](https://git-scm.com/)
*   **Ollama**: For hosting the local AI model. [Download Here](https://ollama.com/)

---

## 2. Clone the Repository

Open your terminal (PowerShell or Command Prompt) and run:

```bash
git clone https://github.com/fayasasis/DIVA.git
cd DIVA
```

---

## 3. Install NPM Dependencies

DIVA has three decoupled `package.json` files that require dependencies to be installed: root, frontend, and backend.

**A. Root Dependencies (Electron & Tools)**
These dependencies are used to run Electron and manage concurrent startup scripts.
```bash
npm install
```

**B. Frontend Dependencies (React UI)**
Navigate to the `frontend` folder and install the React/Vite dependencies:
```bash
cd frontend
npm install
cd ..
```

**C. Backend Dependencies (Express Server)**
Navigate to the `backend` folder and install the base server dependencies:
```bash
cd backend
npm install
cd ..
```

---

## 4. Install Python Dependencies

The Python AI service (`ai/observer.py`, `ai/ears.py`) requires specific libraries for voice and system monitoring. Install them via `pip`.

> **Note**: While you can install these globally, creating a virtual environment is recommended to prevent dependency conflicts.

**Using a Virtual Environment (Recommended):**
```bash
# Create a virtual environment named 'venv'
python -m venv venv

# Activate it (Windows)
venv\Scripts\activate

# IF ON macOS/Linux, activate it using:
# source venv/bin/activate
```

**Install requirements:**
Ensure you are in the root directory, then run:
```bash
pip install -r requirements.txt
```
*Required Python Packages: `vosk`, `sounddevice`, `psutil`*

---

## 5. Download Required AI Models

Since DIVA runs totally offline and locally, you must pre-download the language and voice models.

### A. Large Language Model (Phi-3 via Ollama)
DIVA uses **Phi-3** (a lightweight, high-performance model).
1. Make sure Ollama is running in the background (check your system tray/menu bar).
2. Run this command in your terminal:
```bash
ollama pull phi3
```
*Note: This downloads the model (~2.4GB).*

### B. Voice Recognition Model (Vosk)
The `ears.py` script requires an offline speech recognition model.
1.  Download the **small English model** (approx 40MB) from [Vosk Models](https://alphacephei.com/vosk/models). Recommended: `vosk-model-small-en-us-0.15`
2.  Extract the downloaded zip file.
3.  Rename the extracted folder to `model`.
4.  Move the `model` folder into the `ai/` directory.

**Structure check:**
```
DIVA/
  ai/
    model/ (contains files like am, conf, graph...)
    ears.py
    ...
```

---

## 6. Running the Application

The project is configured so that you only need **one single command** to start everything. 

Ensure you are in the **root project directory** and run:
```bash
npm start
```

### What happens in the background?
1. **Frontend**: Vite server launches automatically at `http://localhost:5173`.
2. **Backend**: Node.js API database server starts locally.
3. **Electron**: The system waits for the frontend to be ready, then launches the Electron desktop shell.
4. **AI/Python**: The Electron main process automatically spawns both the backend server and the Python observer scripts.

> **Warning**: If you used a Python virtual environment in Step 4, make sure it is activated in the terminal session *before* you run `npm start`! Electron spawns the Python process inherited from your current shell execution context.

---

## 7. Troubleshooting

*   **"Python Process Fails to Start"**: Ensure your command variable is `python`. If your system defaults to `python3`, you may need to alias it or manually change `spawn('python', ...)` inside `electron/main.js`.
*   **"Ollama connection failed"**: Ensure the Ollama app is running before starting DIVA.
*   **"Microphone error"**: Check your Windows privacy settings to allow apps/terminals to access the microphone.
*   **"Vosk model not found"**: Ensure the folder is named exactly `model` and is inside `ai/`.
*   **"Port Conflicts"**: If `npm start` fails, ensure you don't have other services running on port `5173` (Frontend Vite Server) or `5000` (Node Backend Server).

# DIVA - Installation & Setup Guide

Welcome to **DIVA (Desktop Intelligent Virtual Assistant)**. This guide will walk you through setting up the complete development environment on your Windows system.

## 1. System Requirements

Before you begin, ensure you have the following installed:

*   **Node.js**: Version 18.0.0 or higher. [Download Here](https://nodejs.org/)
*   **Python**: Version 3.10 or higher. [Download Here](https://www.python.org/)
    *   *Note: Ensure "Add Python to PATH" is checked during installation.*
*   **Ollama**: For hosting the local AI model. [Download Here](https://ollama.com/)
*   **Git**: For cloning the repository. [Download Here](https://git-scm.com/)
*   **Visual Studio Code** (Recommended for editing).

---

## 2. Clone the Repository

Open your terminal (PowerShell or Command Prompt) and run:

```bash
git clone https://github.com/fayasasis/DIVA.git
cd DIVA
```

---

## 3. Install AI Model

DIVA uses **Phi-3** (a lightweight, high-performance model) via Ollama. 

1.  Make sure Ollama is running in the background (check your system tray).
2.  Run this command in your terminal:

```bash
ollama pull phi3
```

*Note: This downloads the model (~2.4GB). If you want to use a different model, update `ai/ollamaService.js`.*

---

## 4. Install Dependencies

DIVA is a modular application (Backend, Frontend, Electron, AI). You need to install dependencies for each part.

### A. Root Dependencies (Electron & Tools)
```bash
npm install
```

### B. Backend Dependencies (Express Server)
```bash
cd backend
npm install
cd ..
```

### C. Frontend Dependencies (React UI)
```bash
cd frontend
npm install
cd ..
```

### D. Python Dependencies (AI Modules)
```bash
pip install -r requirements.txt
```

*Required Python Packages: `vosk`, `sounddevice`, `psutil`*

---

## 5. Download Voice Recognition Model (Vosk)

The `ears.py` script requires an offline speech recognition model.

1.  Download the **small English model** (approx 40MB) from [Vosk Models](https://alphacephei.com/vosk/models).
    *   Recommended: `vosk-model-small-en-us-0.15`
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

To start the entire system (Backend, Frontend, and Electron Shell) with a single command:

1.  Go to the root `DIVA/` folder.
2.  Run:

```bash
npm start
```

### What happens next?
1.  **Vite** starts the Frontend React server (http://localhost:5173).
2.  **Node.js** starts the Backend server (http://localhost:5000).
3.  **Python** scripts (`ears.py`, `observer.py`) start automatically in the background.
4.  **Electron** launches the desktop window.

---

## 7. Troubleshooting

*   **"Ollama connection failed"**: Ensure the Ollama app is running before starting DIVA.
*   **"Microphone error"**: Check your Windows privacy settings to allow apps to access the microphone.
*   **"Vosk model not found"**: Ensure the folder is named exactly `model` and is inside `ai/`.

## 8. Project Structure

*   `/ai`: Python scripts for Voice & App Monitoring.
*   `/backend`: Node.js Express server & Database.
*   `/frontend`: React User Interface.
*   `/electron`: Main desktop shell logic.
*   `/automation`: PowerShell control scripts.

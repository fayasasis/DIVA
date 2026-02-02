# 📘 Setup Guide: How to Run "DIVA" on Your PC

Hey! I’ve uploaded the code, but for it to run on your computer, you need to install the "engines" that power it. Follow these steps exactly.

---

## Phase 1: One-Time Installation (Do this first)

### 1. Install Node.js (The Server Engine)
* Download the **"LTS Version"** here: [https://nodejs.org/](https://nodejs.org/)
* Install it. Keep clicking "Next" -> "Next" -> "Finish".

### 2. Install Python (The Voice Engine)
* Download it here: [https://www.python.org/downloads/](https://www.python.org/downloads/)
* **⚠️ CRITICAL STEP:** On the first screen of the installer, **check the box** that says **"Add Python to PATH"**. If you miss this, the voice features won't work.

### 3. Install Ollama (The Brain)
* Download it here: [https://ollama.com/](https://ollama.com/)
* Install it.
* Once installed, open a generic Command Prompt (search `cmd` in Windows) and type this command to download the brain:
    ```bash
    ollama run phi3
    ```
    *(Wait for it to download. When you see `>>>`, type `/bye` and hit Enter).*

---

## Phase 2: Setting Up the Project

### 1. Get the Code
Pull the latest code from GitHub into a folder on your computer (e.g., `Documents/DIVA`).

### 2. Setup the "Brain & Ears" (Backend)
1.  Open the `DIVA/backend` folder.
2.  Right-click inside the folder -> Select "Open in Terminal" (or Command Prompt).
3.  Type this command and hit Enter:
    ```bash
    npm install
    ```
4.  **Next, install the Python tools.** In the same terminal, type:
    ```bash
    pip install vosk sounddevice
    ```

### 3. Setup the "Face" (Frontend)
1.  Go to the `DIVA/frontend` folder.
2.  Right-click -> "Open in Terminal".
3.  Type this command and hit Enter:
    ```bash
    npm install
    ```

### ⚠️ CHECKPOINT:
Go to the `DIVA/ai` folder. Do you see a folder named **`model`**?
* **YES:** You are good.
* **NO:** Download this file: [vosk-model-small-en-us-0.15.zip](https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip).
    * Unzip it.
    * Rename the extracted folder to `model`.
    * Paste it inside `DIVA/ai/`.

---

## Phase 3: How to Run It (Every Time)

You need to keep **3 separate windows** open for this to work.

### Window 1: The Brain
Make sure the **Ollama** icon is in your system tray (bottom right of Windows). It usually runs automatically.

### Window 2: The Backend (Ears & Hands)
1.  Open Terminal in `DIVA/backend`.
2.  Run:
    ```bash
    node server.js
    ```
3.  **Keep this window open!**

### Window 3: The Frontend (The Interface)
1.  Open Terminal in `DIVA/frontend`.
2.  Run:
    ```bash
    npm run dev
    ```
3.  Hold `Ctrl` and click the link that appears (e.g., `http://localhost:5173`).

---

## Phase 4: How to Test It
1.  Click the **Microphone** button on the website.
2.  Say: *"Open Notepad"* or *"Turn the volume up"*.
3.  Say: *"Tell me a joke."*
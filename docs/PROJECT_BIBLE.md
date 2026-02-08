# DIVA - Digital Intelligent Virtual Assistant
> **Project Bible & Technical Documentation**
> *Latest Update: February 2026*

## 1. Executive Summary
DIVA is a localized, privacy-first **Windows Automation AI Agent**. Unlike cloud-based assistants (Siri, Alexa), DIVA runs entirely on the user's machine (using specific local LLMs like `Phi-3`) and interacts directly with the Windows OS via PowerShell and Node.js.

The core philosophy is **"Determinism over Conversation"**. DIVA prioritizes executing commands instantly and correctly over having a chat.

---

## 2. System Architecture

### 2.1 Tech Stack
*   **Runtime**: Node.js (v18+)
*   **Frontend**: React (Vite) + Tailwind CSS (Cyberpunk Aesthetic)
*   **AI Backend**: Ollama (Running locally on port 11434)
*   **Database**: SQLite (via Sequelize) for persistent chat history.
*   **OS Integration**: `child_process` spawning PowerShell commands.

### 2.2 Core Modules (`/automation/modules/`)
DIVA is modular. The central `index.js` allows creating a router that delegates intent to specific controllers:

1.  **`appControl.js`**: Opens/Closes applications.
    *   *Features*: Smart fuzzy matching (e.g., "Calc" -> "CalculatorApp").
    *   *Nuance*: Uses `Get-StartApps` and `Get-Process` for hybrid detection.
2.  **`fileControl.js`**: Managed file system operations.
    *   *Mode*: **Stateless Direct Action** (Reverted from Wizard mode).
    *   *Features*: Create, Delete, Move, Rename.
    *   *Path Resolution*: intelligently maps "Downloads", "Photos", "Movies" to real system paths. Defaults to Desktop.
3.  **`windowControl.js`**: Window management.
    *   *Features*: Minimize, Maximize, Snap (Left/Right), Switch Focus.
4.  **`systemControl.js`**: Hardware control.
    *   *Features*: Volume (0-100), Mute, Brightness, Lock Screen.
5.  **`webControl.js`**: Browser & Media.
    *   *Features*: Google Search, YouTube Search, Spotify Web Control (Play/Pause/Next).

---

## 3. AI & Prompt Engineering (The "Brain")

### 3.1 The Model
*   **Model**: `Phi-3` (Optimized for speed and instruction following).
*   **Configuration**:
    *   `temperature: 0.0` (Maximum determinism).
    *   `num_predict: 200` (Short, concise outputs).
    *   `format: "json"` (Enforced JSON mode).

### 3.2 System Prompt Strategy
DIVA uses a **Strict Logic Prompt** to prevent "hallucinations" (where the AI invents commands or talks when it should act).

*   **Rule 1: JSON Absolute**: All commands MUST output minified JSON.
*   **Rule 2: No Comments**: Comments like `// target is null` break the parser, so they are explicitly forbidden via Stop Tokens (`//`, `/*`).
*   **Rule 3: Navigation Override**: Single-letter inputs ("D") are intercepted as File Navigation commands.

**Example Command Output:**
```json
{
  "type": "system_action",
  "intent": "app_control",
  "entities": {
    "action": "open",
    "target": "Calculator"
  }
}
```

---

## 4. Current Feature Set (Status: Stable)

| Feature | Commands Example | Status |
| :--- | :--- | :--- |
| **App Control** | "Open VS Code", "Close Spotify" | ✅ Working |
| **File Ops** | "Create folder Photos", "Delete temp.txt" | ✅ Working (Stateless) |
| **Window Ops** | "Minimize this", "Snap left" | ✅ Working |
| **System** | "Volume 50", "Mute", "Lock PC" | ✅ Working |
| **Web/Search** | "Search Google for AI", "Play Jazz on YouTube" | ✅ Working |
| **Chat History** | (Sidebar History, New Chat, Delete) | ✅ Persistent (SQLite) |
| **TTS** | (Text-to-Speech) "Read this to me" | ✅ Integrated |

---

## 5. Development Nuances & "Gotchas"

1.  **The "Zombie Port" Issue**: Sometimes `node server.js` fails with `EADDRINUSE: 5000`. This happens if the previous process didn't exit cleanly.
    *   *Fix*: Run `taskkill /F /IM node.exe` or find the PID occupying port 5000.
2.  **JSON Hallucination**: Phi-3 sometimes tries to be helpful by adding comments to JSON.
    *   *Fix*: The `ollamaService` now strips comments and uses `stop: ["//"]` to physically prevent this.
3.  **File Wizard Reversion**: We briefly attempted a stateful "Wizard" (asking for drives, navigating folders). It proved too slow/clunky. We reverted to "Direct Action" (command -> execution) for speed.

---

## 6. Future Roadmap
*   **Contextual Memory**: Remembering "Open *that* file" referring to the last file mentioned.
*   **UI Themes**: Allowing user to switch between "Cyberpunk" (Current) and "Minimal" themes.
*   **Voice Input**: Adding Whisper for direct voice commands.

---
*Maintained by the DIVA Development Team*

# DIVA Assistant: Supported Actions

DIVA is capable of controlling various aspects of your system through natural language. Below is a comprehensive list of operations categorized by the module that handles them.

---

## 1. System Control (`systemControl.js`)

Manage hardware and OS-level operations.

*   **Shutdown/Restart/Sleep**: "Shutdown computer", "Restart system", "Sleep"
*   **Lock Screen**: "Lock computer", "Lock screen"
*   **Volume Control**:
    *   "Volume up", "Volume down"
    *   "Mute", "Unmute"
    *   Specific percentages: "Set volume to 50%"
*   **Brightness Control**:
    *   Increase/Decrease: "Brightness up", "Decrease brightness"
    *   Specific percentages: "Set brightness to 70%"

---

## 2. App Control (`appControl.js`)

Launch, close, and manage installed applications.

*   **Open Applications**: "Open [App Name]", "Start Notepad", "Launch Chrome"
*   **Close Applications**: "Close [App Name]", "Quit Spotify"
*   **Restart Applications**: "Restart [App Name]"
*   **Smart Aliases**: Understands common names like "vscode" (Visual Studio Code), "edge" (Microsoft Edge), "cmd" (Command Prompt), etc.
*   **Direct Path Execution**: Can execute direct file paths if provided instead of an app name (e.g., "Open C:\\path\\to\\script.exe").

---

## 3. Window Control (`windowControl.js`)

Manage application windows on your desktop.

*   **Switch Focus**: "Switch to [App Name]", "Bring [App Name] to front"
*   **Minimize/Maximize**: "Minimize [App Name]", "Maximize [App Name]", "Restore [App Name]"
*   **Minimize All**: "Minimize all windows", "Minimize everything"
*   **Show Desktop**: "Show desktop"

---

## 4. Web & Media Control (`webControl.js`)

Handle browser navigation, search engines, and media playback.

*   **Web Search**: "Search Google for [Query]", "Find information about [Topic]"
*   **Direct Navigation**: Opens common sites directly (e.g., "Open GitHub", "Go to WhatsApp", "Open example.com").
*   **Specific Searches**:
    *   **Images**: "Search images of cats", "Find pictures of the Eiffel Tower"
    *   **Weather**: "Check the weather in London"
    *   **StackOverflow**: "Search StackOverflow for python list comprehension"
*   **YouTube**:
    *   "Play [Video/Music] on YouTube" (Auto-plays the first result)
    *   "Search YouTube for [Query]"
    *   "Open YouTube"
*   **Spotify**:
    *   "Open Spotify"
    *   "Play music on Spotify" (Plays a default popular playlist)
    *   "Play [Song Name] on Spotify" (Searches and plays a specific song)
*   **Media Keys**: "Play/Pause", "Next track", "Previous track"
*   **Browser Tabs (When browser is focused)**: "New tab", "Close tab", "Restore tab", "Next tab"  !!!!!

---

## 5. File Control (`fileControl.js`)

Manage your file system. Understands special keywords like "Desktop", "Downloads", "Documents", "Pictures", "Videos", "Music".

*   **Create Files/Folders**: "Create a folder called 'Test' on Desktop", "Make a file named 'notes.txt'"
*   **Delete Files/Folders**: "Delete 'notes.txt'", "Remove the 'Test' folder"
*   **List Directory Contents**: "List files in Downloads", "What's on my Desktop?"
*   **Open Files**: "Open 'report.pdf' in Documents"
*   **Rename Files/Folders**: "Rename 'old.txt' to 'new.txt'"

---

## 6. Note Control (`noteControl.js`)

Quickly save and retrieve text snippets via a database.

*   **Add Note**: "Add a note: Remember to buy milk", "Save a note"
*   **Read Notes**: "List notes", "Read my notes" (Returns the 5 most recent notes)

---

## 7. Conversation & Memory (`ollamaService.js`)

DIVA remembers the context of the conversation and can answer follow-up questions.

*   **Contextual Follow-ups**: If you say "I live in Tokyo", you can later ask "Where do I live?"
*   **General Chat**: Standard AI conversational capabilities.
*   **Fallback to Web Search**: If DIVA cannot creatively answer due to limitations (e.g., asking for real-time news), she will seamlessly convert the request into a Web Search.

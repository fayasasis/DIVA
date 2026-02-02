// actionHandler.js
//  DIVA Muscles Layer
// This file EXECUTES system actions decided by the AI brain.
// No AI logic lives here. This file only "does", never "thinks".

const { exec } = require('child_process'); // Used to run system commands (Windows)

// --------------------------------------------------
//  Helper Function: Safe PowerShell Executor
// --------------------------------------------------
// Why this exists:
// - Some Windows actions (volume, mute) require PowerShell
// - PowerShell can freeze or hang
// - We protect DIVA using a timeout so the app never crashes
const runPowerShell = (command) => {
    return new Promise((resolve) => {

        // Start a safety timer (2 seconds max)
        const timer = setTimeout(() => {
            console.log("⚠️ PowerShell Timed Out (Continuing safely)");
            resolve("Done (Timeout)"); // Move on safely
        }, 2000);

        console.log(`⚡ Running PowerShell: ${command}`);

        // Execute the PowerShell command
        exec(`powershell -c "${command}"`, (error) => {
            clearTimeout(timer); // Stop timeout if command finishes

            // We DO NOT crash on errors — assistant must stay alive
            if (error) {
                console.warn(`⚠️ PowerShell Error (Non-critical): ${error.message}`);
                resolve("Action attempted.");
            } else {
                resolve("Done.");
            }
        });
    });
};

// --------------------------------------------------
//  Main Action Executor
// --------------------------------------------------
// This function receives a DECISION from the AI
// Example decision:
// {
//   type: "system_action",
//   intent: "open_app",
//   entities: { app: "notepad" }
// }
async function executeAction(decision) {

    // Extract intent (what to do)
    const intent = decision.intent;

    // Extract entity safely (what to act on)
    // Prevents crashes if AI sends incomplete data
    const entity =
        (decision.entities &&
            (decision.entities.app || decision.entities.query || "")) || "";

    console.log(`🦾 Executing Action: ${intent} → "${entity}"`);

    // --------------------------------------------------
    // OPEN APPLICATIONS
    // --------------------------------------------------
    if (intent === 'open_app') {

        // Whitelisted and safe application mappings
        const appMap = {
            'notepad': 'notepad',
            'calculator': 'calc',
            'chrome': 'start chrome',
            'vscode': 'code',
            'settings': 'start ms-settings:',
            'file explorer': 'explorer'
        };

        // If app is known → use safe command
        // Otherwise → try opening it generically
        const command =
            appMap[entity.toLowerCase()] || `start "" "${entity}"`;

        // Execute the command
        exec(command, (err) => {
            if (err) console.error("❌ Failed to open app:", err);
        });

        return `I have opened ${entity} for you.`;
    }

    // --------------------------------------------------
    // SYSTEM CONTROLS (Volume / Lock)
    // --------------------------------------------------
    else if (intent === 'system_control') {

        const cmd = entity.toLowerCase();

        // Increase system volume
        if (cmd.includes('volume up')) {
            await runPowerShell(
                '$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]175 * 5)'
            );
            return "Turning volume up.";
        }

        // Decrease system volume
        else if (cmd.includes('volume down')) {
            await runPowerShell(
                '$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]174 * 5)'
            );
            return "Turning volume down.";
        }

        // Mute system volume
        else if (cmd.includes('mute')) {
            await runPowerShell(
                '$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]173)'
            );
            return "Muted audio.";
        }

        // Lock Windows screen
        else if (cmd.includes('lock')) {
            exec('rundll32.exe user32.dll,LockWorkStation');
            return "Locking screen.";
        }
    }

    // --------------------------------------------------
    // 3️⃣ WEB SEARCH
    // --------------------------------------------------
    else if (intent === 'web_search') {

        // Build Google search URL
        const url = `https://www.google.com/search?q=${encodeURIComponent(entity)}`;

        // Open browser with search
        exec(`start chrome "${url}"`);

        return `Searching Google for ${entity}.`;
    }

    // --------------------------------------------------
    // FALLBACK (Unknown Action)
    // --------------------------------------------------
    return "I couldn't perform that system action.";
}

// Export function so backend can use it
module.exports = { executeAction };

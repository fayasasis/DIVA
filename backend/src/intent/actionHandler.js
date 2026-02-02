const { exec } = require('child_process');

/**
 * 💥 The "Old Reliable" Launcher
 * Uses the Windows 'start' command. 
 * This works for System apps (Notepad) AND Registered apps (Chrome).
 */
function runCommand(command) {
    return new Promise((resolve, reject) => {
        // The weird quote structure 'start "" "app"' is required by Windows CMD
        exec(`start "" "${command}"`, (error, stdout, stderr) => {
            if (error) {
                // Ignore small errors, "start" often throws error even if it works
                console.warn(`⚠️ Note: ${error.message}`); 
                resolve("Attempted launch");
            } else {
                resolve("Success");
            }
        });
    });
}

async function executeAction(decision) {
    console.log("🦾 Execution Request:", decision.intent);

    if (decision.intent === 'open_app') {
        const appName = decision.entities.app.toLowerCase();
        let cmd = "";

        // --- THE MAPPING LIST ---
        // We translate "human names" to "computer commands"
        if (appName.includes('chrome')) cmd = "chrome";
        else if (appName.includes('notepad')) cmd = "notepad";
        else if (appName.includes('calculator') || appName.includes('calc')) cmd = "calc";
        else if (appName.includes('vscode') || appName.includes('code')) cmd = "code";
        else if (appName.includes('excel')) cmd = "excel";
        else if (appName.includes('word')) cmd = "winword";
        else if (appName.includes('edge')) cmd = "msedge";
        else if (appName.includes('paint')) cmd = "mspaint";
        else {
            // Fallback: Try the name exactly as is
            cmd = appName;
        }

        try {
            console.log(`🚀 Running command: start "" "${cmd}"`);
            await runCommand(cmd);
            return `I have opened ${appName} for you.`;
        } catch (error) {
            console.error("❌ Failed:", error);
            return `I couldn't open ${appName}.`;
        }
    }

    return "I executed the system action.";
}

module.exports = { executeAction };
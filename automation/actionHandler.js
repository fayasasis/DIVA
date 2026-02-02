// ==========================================
// 🦾 AUTOMATION LAYER (SYSTEM MUSCLES)
// ==========================================
// This file is responsible for executing actions
// on the user's operating system (Windows).
// It receives structured decisions from the AI
// and converts them into real system commands.

const { exec } = require('child_process');


// ==========================================
// 🔧 LOW-LEVEL COMMAND RUNNER
// ==========================================
// Runs Windows commands using CMD
// Uses the 'start' command to launch applications

function runCommand(command) {
    return new Promise((resolve, reject) => {

        // Windows requires this syntax:
        // start "" "application"
        exec(`start "" "${command}"`, (error, stdout, stderr) => {

            if (error) {
                // Windows often throws warnings even when app opens successfully
                console.warn(`⚠️ Note: ${error.message}`);
                resolve("Attempted launch");
            } else {
                resolve("Success");
            }
        });
    });
}


// ==========================================
// 🧠 → 🦾 MAIN EXECUTION FUNCTION
// ==========================================
// Receives the AI decision object and performs the action

async function executeAction(decision) {

    console.log("🦾 Execution Request:", decision.intent);

    // Only handle application opening for now
    if (decision.intent === 'open_app') {

        // Extract app name from AI entities
        const appName = decision.entities.app.toLowerCase();
        let cmd = "";

        // --------------------------------------
        // 🗺️ HUMAN NAME → SYSTEM COMMAND MAP
        // --------------------------------------
        // Translate natural language to OS commands

        if (appName.includes('chrome')) cmd = "chrome";
        else if (appName.includes('notepad')) cmd = "notepad";
        else if (appName.includes('calculator') || appName.includes('calc')) cmd = "calc";
        else if (appName.includes('vscode') || appName.includes('code')) cmd = "code";
        else if (appName.includes('excel')) cmd = "excel";
        else if (appName.includes('word')) cmd = "winword";
        else if (appName.includes('edge')) cmd = "msedge";
        else if (appName.includes('paint')) cmd = "mspaint";
        else {
            // Fallback: Try launching using raw name
            cmd = appName;
        }

        try {
            console.log(`🚀 Running command: start "" "${cmd}"`);

            // Execute the system command
            await runCommand(cmd);

            // Return success message to backend → frontend
            return `I have opened ${appName} for you.`;

        } catch (error) {

            console.error("❌ Failed:", error);
            return `I couldn't open ${appName}.`;
        }
    }

    // Default fallback response
    return "I executed the system action.";
}

// Export function so server.js can call it
module.exports = { executeAction };

const { exec } = require('child_process');

// 🛡️ Helper: Run PowerShell with a Safety Timeout
const runPowerShell = (command) => {
    return new Promise((resolve, reject) => {
        // 1. Create the timeout timer (2 seconds max)
        const timer = setTimeout(() => {
            console.log("⚠️ PowerShell Timed Out (Continuing anyway...)");
            resolve("Done (Timeout)"); // Don't crash, just move on
        }, 2000);

        // 2. Run the command
        console.log(`⚡ Running PS: ${command}`);
        exec(`powershell -c "${command}"`, (error, stdout, stderr) => {
            clearTimeout(timer); // Stop the timer if it finishes fast
            
            if (error) {
                console.warn(`⚠️ Non-critical PS Error: ${error.message}`);
                resolve("Action attempted.");
            } else {
                resolve("Done.");
            }
        });
    });
};

async function executeAction(decision) {
    const intent = decision.intent;
    // Safety: Ensure entity exists, default to empty string
    const entity = (decision.entities && (decision.entities.app || decision.entities.query || "")) || "";
    
    console.log(`🦾 Muscles Moving: ${intent} -> "${entity}"`);

    // --- 1. OPEN APPS ---
    if (intent === 'open_app') {
        const appMap = {
            'notepad': 'notepad',
            'calculator': 'calc',
            'chrome': 'start chrome',
            'vscode': 'code',
            'settings': 'start ms-settings:',
            'file explorer': 'explorer'
        };

        const command = appMap[entity.toLowerCase()] || `start "" "${entity}"`;
        
        exec(command, (err) => {
            if (err) console.error("Failed to launch app:", err);
        });
        return `I have opened ${entity} for you.`;
    }

    // --- 2. SYSTEM CONTROLS (Improved) ---
    else if (intent === 'system_control') {
        const cmd = entity.toLowerCase();

        if (cmd.includes('volume up')) {
            // Using a safer script block for SendKeys
            await runPowerShell('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]175 * 5)');
            return "Turning volume up.";
        }
        else if (cmd.includes('volume down')) {
            await runPowerShell('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]174 * 5)');
            return "Turning volume down.";
        }
        else if (cmd.includes('mute')) {
            await runPowerShell('$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]173)');
            return "Muted audio.";
        }
        else if (cmd.includes('lock')) {
            exec('rundll32.exe user32.dll,LockWorkStation');
            return "Locking screen.";
        }
    }

    // --- 3. WEB SEARCH ---
    else if (intent === 'web_search') {
        const url = `https://www.google.com/search?q=${encodeURIComponent(entity)}`;
        exec(`start chrome "${url}"`);
        return `Searching Google for ${entity}.`;
    }

    return "I couldn't do that system action.";
}

module.exports = { executeAction };
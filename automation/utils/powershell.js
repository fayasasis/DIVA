// ==============================
// POWERSHELL UTILITIES
// ==============================
// This is the bridge between Node.js and the Windows Operating System.
// It allows us to execute any PowerShell command from our JS code.

// Import 'spawn' to run child processes
const { spawn } = require('child_process');

/**
 * Executes a PowerShell command and returns Success/Fail boolean.
 * Best for commands where we don't care about the text output (e.g., "Mute Volume").
 * 
 * @param {string} psCommand - The PowerShell script to run.
 * @returns {Promise<boolean>} - True if exit code is 0 (success).
 */
const runPowerShell = (psCommand) => {
    return new Promise((resolve) => {
        // Spawn a new PowerShell process
        const child = spawn('powershell', [
            '-NoProfile',        // Do not load user profile (faster startup)
            '-ExecutionPolicy', 'Bypass', // Allow script execution
            '-Command', psCommand // The actual command
        ]);

        // Capture generic output to detect if anything happened
        let output = '', error = '';
        child.stdout.on('data', (d) => output += d);
        child.stderr.on('data', (d) => error += d);

        // On finished
        child.on('close', (code) => {
            if (error) console.error("PowerShell Error:", error);
            resolve(code === 0 || !error); // Resolve true if no error
        });
    });
};

/**
 * Executes a PowerShell command and returns the TEXT OUTPUT.
 * Best for data retrieval (e.g., "Get-StartApps", "Get-Process").
 * 
 * @param {string} psCommand - The PowerShell script to run.
 * @returns {Promise<string>} - The trimmed stdout string.
 */
const runPowerShellData = (psCommand) => {
    return new Promise((resolve) => {
        // Spawn process
        const child = spawn('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand
        ]);

        let output = '';
        // Buffer the output data
        child.stdout.on('data', (d) => output += d);

        // Resolve the final string when process closes
        child.on('close', () => resolve(output.trim()));
    });
};

/**
 * Helper to launch an application in 'detached' mode (fire and forget).
 * This prevents the Node process from waiting for the app to close.
 * @param {string} cmd - Command to run.
 */
const launchApp = (cmd) => {
    // CMD /C Start "" [Command] runs the command in a separate window context
    const s = spawn('cmd', ['/c', 'start', '', cmd], { detached: true, stdio: 'ignore' });
    s.unref(); // Allow Node parent process to exit even if child is running
};

module.exports = { runPowerShell, runPowerShellData, launchApp };

const { spawn } = require('child_process');

// 🛡️ HELPER: PowerShell Execution
const runPowerShell = (psCommand) => {
    return new Promise((resolve) => {
        const child = spawn('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand
        ]);
        let output = '', error = '';
        child.stdout.on('data', (d) => output += d);
        child.stderr.on('data', (d) => error += d);
        child.on('close', (code) => {
            if (error) console.error("❌ PowerShell Error:", error);
            resolve(code === 0 || !error);
        });
    });
};

// 🛡️ HELPER: PowerShell with Output
const runPowerShellData = (psCommand) => {
    return new Promise((resolve) => {
        const child = spawn('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand
        ]);
        let output = '';
        child.stdout.on('data', (d) => output += d);
        child.on('close', () => resolve(output.trim()));
    });
};

const launchApp = (cmd) => {
    const s = spawn('cmd', ['/c', 'start', '', cmd], { detached: true, stdio: 'ignore' });
    s.unref();
};

module.exports = { runPowerShell, runPowerShellData, launchApp };

// ==============================
// SYSTEM CONTROL MODULE
// ==============================
// Handles hardware and OS-level commands.
// Includes Volume, Brightness, Power (Shutdown/Sleep), and Lock Screen.

const { runPowerShell } = require('../utils/powershell'); // PS Runner

/**
 * Handle Critical System Overrides
 * These are checked BEFORE AI processing because they are simple keywords.
 * @param {string} cleanQuery - The user's normalized input.
 */
const handleSystemOverrides = async (cleanQuery) => {

    // --- POWER CONTROLS ---

    // Shutdown
    if (cleanQuery.includes('shutdown') || cleanQuery.includes('turn off computer')) {
        // Stop-Computer: Windows command to shut down. Seconds 10 gives user time to abort.
        await runPowerShell('Stop-Computer -Force -Seconds 10');
        return "Shutting down in 10s.";
    }

    // Restart
    if (cleanQuery.includes('restart system') || cleanQuery.includes('restart computer') || cleanQuery.includes('reboot')) {
        await runPowerShell('Restart-Computer -Force -Seconds 10');
        return "Restarting in 10s.";
    }

    // Sleep
    if (cleanQuery.includes('sleep') || cleanQuery.includes('suspend')) {
        // SetSuspendState: Native Windows API call to trigger sleep mode.
        await runPowerShell('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
        return "Sleeping system.";
    }

    // Lock Screen
    if (cleanQuery.includes('lock')) {
        // LockWorkStation: Locks the user session.
        await runPowerShell('rundll32.exe user32.dll,LockWorkStation');
        return "Locked.";
    }

    // --- VOLUME OVERRIDE (Mute/Unmute) ---
    // Uses WScript.Shell SendKeys to simulate keyboard media keys.
    if (cleanQuery.includes('mute') || cleanQuery.includes('unmute')) {
        // Char 173 is the Mute Toggle key code.
        await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]173)`);
        return "Muted/Unmuted.";
    }

    // --- BRIGHTNESS CONTROL ---
    // Requires interactions with WMI (Windows Management Instrumentation)
    if (cleanQuery.includes('brightness')) {
        // Extract number if user said "Brightness 50%"
        const numMatch = cleanQuery.match(/(\d+)/);
        try {
            if (numMatch) {
                // Case 1: Specific Level
                const level = parseInt(numMatch[0]);
                // WMI Call to set specific brightness
                const ps = `(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${level})`;
                await runPowerShell(ps);
                return `Brightness set to ${level}%.`;

            } else if (cleanQuery.includes('up') || cleanQuery.includes('increase')) {
                // Case 2: Increase relative (+10%)
                const ps = `
                    $monitor = Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods
                    $current = (Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness
                    $new = [Math]::Min($current + 10, 100) # Clamp at 100
                    $monitor.WmiSetBrightness(1, $new)
                `;
                await runPowerShell(ps);
                return "Brightness increased.";

            } else if (cleanQuery.includes('down') || cleanQuery.includes('decrease')) {
                // Case 3: Decrease relative (-10%)
                const ps = `
                    $monitor = Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods
                    $current = (Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness
                    $new = [Math]::Max($current - 10, 0) # Clamp at 0
                    $monitor.WmiSetBrightness(1, $new)
                `;
                await runPowerShell(ps);
                return "Brightness decreased.";
            }
        } catch (e) {
            return `Brightness Error: ${e.message}`; // Fallback if hardware doesn't support WMI
        }
    }

    // --- VOLUME PERCENTAGE ---
    // Windows doesn't easily convert "Volume 50%" to keystrokes.
    // Logic: Reset to 0, then press 'Volume Up' N times.
    if (cleanQuery.includes('volume') && cleanQuery.match(/\d+/)) {
        const numMatch = cleanQuery.match(/(\d+)/);
        const level = parseInt(numMatch[0]);
        // Each keystroke is usually 2 steps.
        const clicks = Math.ceil(level / 2);

        const ps = `
            $ws = New-Object -ComObject WScript.Shell
            1..50 | % { $ws.SendKeys([char]174) } # Spam Volume Down (Reset to 0)
            1..${clicks} | % { $ws.SendKeys([char]175) } # Spam Volume Up (Reach target)
        `;
        await runPowerShell(ps);
        return `Set volume to ${level}%.`;
    }

    return null; // No override triggered
};

/**
 * Standard System Execution
 * Handles generalized commands if Overrides didn't catch them.
 */
const executeSystemAction = async (target, action, entities, rawIntent) => {
    const cmd = (entities.command || rawIntent).toLowerCase();

    // Relative Volume (Up/Down) via Keystrokes
    if (cmd.includes('volume') || target.includes('volume')) {
        if (cmd.includes('up')) {
            // Char 175 = Volume Up
            await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; 1..5 | % { $ws.SendKeys([char]175) }`);
            return "Volume up.";
        }
        if (cmd.includes('down')) {
            // Char 174 = Volume Down
            await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; 1..5 | % { $ws.SendKeys([char]174) }`);
            return "Volume down.";
        }
    }

    return "System command not recognized or already handled.";
};

module.exports = { handleSystemOverrides, executeSystemAction };

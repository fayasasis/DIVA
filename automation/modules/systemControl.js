const { runPowerShell } = require('../utils/powershell');

const handleSystemOverrides = async (cleanQuery) => {
    // 1. Power Controls
    if (cleanQuery.includes('shutdown') || cleanQuery.includes('turn off computer')) {
        await runPowerShell('Stop-Computer -Force -Seconds 10');
        return "Shutting down in 10s.";
    }
    if (cleanQuery.includes('restart system') || cleanQuery.includes('restart computer') || cleanQuery.includes('reboot')) {
        await runPowerShell('Restart-Computer -Force -Seconds 10');
        return "Restarting in 10s.";
    }
    if (cleanQuery.includes('sleep') || cleanQuery.includes('suspend')) {
        await runPowerShell('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
        return "Sleeping system.";
    }
    if (cleanQuery.includes('lock')) {
        await runPowerShell('rundll32.exe user32.dll,LockWorkStation');
        return "Locked.";
    }

    // 2. Mute Override
    if (cleanQuery.includes('mute') || cleanQuery.includes('unmute')) {
        await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys([char]173)`);
        return "Muted/Unmuted.";
    }

    // 3. Brightness Override
    if (cleanQuery.includes('brightness')) {
        const numMatch = cleanQuery.match(/(\d+)/);
        try {
            if (numMatch) {
                const level = parseInt(numMatch[0]);
                const ps = `(Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1,${level})`;
                await runPowerShell(ps);
                return `Brightness set to ${level}%.`;
            } else if (cleanQuery.includes('up') || cleanQuery.includes('increase')) {
                const ps = `
                    $monitor = Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods
                    $current = (Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness
                    $new = [Math]::Min($current + 10, 100)
                    $monitor.WmiSetBrightness(1, $new)
                `;
                await runPowerShell(ps);
                return "Brightness increased.";
            } else if (cleanQuery.includes('down') || cleanQuery.includes('decrease')) {
                const ps = `
                    $monitor = Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods
                    $current = (Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightness).CurrentBrightness
                    $new = [Math]::Max($current - 10, 0)
                    $monitor.WmiSetBrightness(1, $new)
                `;
                await runPowerShell(ps);
                return "Brightness decreased.";
            }
        } catch (e) {
            return `Brightness Error: ${e.message}`;
        }
    }

    // 4. Volume Percentage Override
    if (cleanQuery.includes('volume') && cleanQuery.match(/\d+/)) {
        const numMatch = cleanQuery.match(/(\d+)/);
        const level = parseInt(numMatch[0]);
        const clicks = Math.ceil(level / 2);
        const ps = `
            $ws = New-Object -ComObject WScript.Shell
            1..50 | % { $ws.SendKeys([char]174) }
            1..${clicks} | % { $ws.SendKeys([char]175) }
        `;
        await runPowerShell(ps);
        return `Set volume to ${level}%.`;
    }

    return null; // No override triggered
};

const executeSystemAction = async (target, action, entities, rawIntent) => {
    // Basic AI-driven fallback (mostly already covered by overrides)
    const cmd = (entities.command || rawIntent).toLowerCase();

    // Relative Volume (Up/Down)
    if (cmd.includes('volume') || target.includes('volume')) {
        if (cmd.includes('up')) {
            await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; 1..5 | % { $ws.SendKeys([char]175) }`);
            return "Volume up.";
        }
        if (cmd.includes('down')) {
            await runPowerShell(`$ws = New-Object -ComObject WScript.Shell; 1..5 | % { $ws.SendKeys([char]174) }`);
            return "Volume down.";
        }
    }

    return "System command not recognized or already handled.";
};

module.exports = { handleSystemOverrides, executeSystemAction };

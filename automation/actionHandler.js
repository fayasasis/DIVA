const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 🔗 FIX PATH TO MODEL: Go up one level (..), then into backend/models
const Note = require('../backend/models/Note'); 

// 🛡️ HELPER: PowerShell
const runPowerShell = (psCommand) => {
    return new Promise((resolve) => {
        const child = spawn('powershell', [
            '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand
        ]);
        let output = '', error = '';
        child.stdout.on('data', (d) => output += d);
        child.stderr.on('data', (d) => error += d);
        child.on('close', (code) => resolve(code === 0 || !error));
    });
};

const launchApp = (cmd) => {
    const s = spawn('cmd', ['/c', 'start', '', cmd], { detached: true, stdio: 'ignore' });
    s.unref();
};

async function executeAction(decision) {
    const rawIntent = (decision.intent || decision.type || "").toLowerCase();
    const entities = decision.entities || {};
    const target = (entities.app || entities.name || entities.target || entities.query || "").toLowerCase().trim();
    const action = (entities.action || entities.command || "").toLowerCase();

    console.log(`🦾 Processing: [${rawIntent}] Action: ${action} | Target: ${target}`);

    // --- 1. APP CONTROL ---
    if (rawIntent.includes('app') || (rawIntent.includes('open') && !rawIntent.includes('url'))) {
        const appMap = {
            'notepad': { exe: 'notepad', proc: 'notepad' },
            'calculator': { exe: 'calc', proc: 'CalculatorApp' },
            'chrome': { exe: 'chrome', proc: 'chrome' },
            'spotify': { exe: 'spotify', proc: 'spotify' },
            'vs code': { exe: 'code', proc: 'Code' },
            'edge': { exe: 'msedge', proc: 'msedge' },
            'explorer': { exe: 'explorer', proc: 'explorer' },
            'task manager': { exe: 'taskmgr', proc: 'Taskmgr' },
            'youtube': { exe: 'chrome "youtube.com"', proc: 'chrome' }
        };
        const appData = appMap[target] || { exe: target, proc: target };

        if (action === 'close') {
            await runPowerShell(`Stop-Process -Name "${appData.proc}" -Force -ErrorAction SilentlyContinue`);
            return `Closing ${target}.`;
        } else if (action === 'restart') {
            await runPowerShell(`Stop-Process -Name "${appData.proc}" -Force -ErrorAction SilentlyContinue`);
            await new Promise(r => setTimeout(r, 1500)); 
            launchApp(appData.exe);
            return `Restarting ${target}.`;
        } else {
            launchApp(appData.exe);
            return `Opening ${target}.`;
        }
    }

    // --- 2. WINDOW CONTROL ---
    else if (rawIntent.includes('window') || rawIntent === 'switch_focus' || action === 'show_desktop') {
        const finalAction = action || rawIntent; 
        const windowApi = `
            $def = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
            $def += '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
            $type = Add-Type -MemberDefinition $def -Name Win32WindowControl -Namespace Win32Functions -PassThru
        `;

        if (finalAction.includes('desktop')) {
            await runPowerShell(`(New-Object -ComObject Shell.Application).ToggleDesktop()`);
            return "Toggling desktop.";
        }
        if (finalAction.includes('minimize')) {
            if (target === 'current' || target === '') {
                await runPowerShell(`(New-Object -ComObject Shell.Application).MinimizeAll()`);
                return "Minimized all.";
            }
            const script = `
                ${windowApi}
                $proc = Get-Process | Where-Object { $_.ProcessName -like "*${target}*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
                if ($proc) { $type::ShowWindowAsync($proc.MainWindowHandle, 2) }
            `;
            await runPowerShell(script);
            return `Minimizing ${target}.`;
        }
        if (finalAction.includes('switch') || finalAction.includes('focus')) {
            const script = `
                ${windowApi}
                $proc = Get-Process | Where-Object { $_.ProcessName -like "*${target}*" -and $_.MainWindowHandle -ne 0 } | Select-Object -First 1
                if ($proc) { 
                    $type::ShowWindowAsync($proc.MainWindowHandle, 9) 
                    $type::SetForegroundWindow($proc.MainWindowHandle) 
                }
            `;
            await runPowerShell(script);
            return `Switched to ${target}.`;
        }
    }

    // --- 3. SYSTEM CONTROL ---
    else if (rawIntent.includes('system') || rawIntent.includes('volume')) {
        const cmd = (entities.command || rawIntent).toLowerCase();
        const wsDef = '$ws=New-Object -ComObject WScript.Shell;';
        if (cmd.includes('up')) { await runPowerShell(`${wsDef} $ws.SendKeys([char]175 * 5)`); return "Volume up."; }
        if (cmd.includes('down')) { await runPowerShell(`${wsDef} $ws.SendKeys([char]174 * 5)`); return "Volume down."; }
        if (cmd.includes('mute')) { await runPowerShell(`${wsDef} $ws.SendKeys([char]173)`); return "Muted."; }
        if (cmd.includes('lock')) { await runPowerShell('rundll32.exe user32.dll,LockWorkStation'); return "Locked."; }
    }

    // --- 4. WEB ---
    else if (rawIntent.includes('web') || rawIntent.includes('search')) {
        if (rawIntent.includes('search') || entities.type === 'search') {
            const url = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
            launchApp(`chrome "${url}"`);
            return `Searching Google for ${target}.`;
        } else {
            let url = target.includes('.') ? target : target + ".com";
            launchApp(`chrome "${url}"`);
            return `Opening ${url}.`;
        }
    }

    // --- 5. FILES ---
    else if (rawIntent.includes('file') || rawIntent.includes('folder')) {
        let desktopPath = path.join(os.homedir(), 'Desktop');
        if (!fs.existsSync(desktopPath)) desktopPath = path.join(os.homedir(), 'OneDrive', 'Desktop');
        const targetPath = path.join(desktopPath, entities.name || "New_Folder");

        if (action.includes('create')) {
            if (!fs.existsSync(targetPath)) fs.mkdirSync(targetPath);
            return `Created "${entities.name}".`;
        } 
    }

    // --- 6. NOTES (SQLite) ---
    else if (rawIntent.includes('note')) {
        try {
            if (action === 'add' || rawIntent.includes('add')) {
                await Note.create({ content: entities.content || target });
                return "Note saved.";
            } else if (action === 'list' || rawIntent.includes('read')) {
                const notes = await Note.findAll({ order: [['createdAt', 'DESC']], limit: 5 });
                return notes.length ? "Recent notes: " + notes.map(n => n.content).join(", ") : "No notes.";
            }
        } catch (e) { return "Database error."; }
    }

    return "Done.";
}

module.exports = { executeAction };
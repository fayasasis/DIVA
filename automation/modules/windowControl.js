const { runPowerShell, runPowerShellData } = require('../utils/powershell');
const { findBestMatch } = require('../utils/matching');

// Reusable Force Focus Function
const forceFocusWindow = async (targetName) => {
    const windowApi = `
        $def = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
        $def += '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
        $def += '[DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);'
        $type = Add-Type -MemberDefinition $def -Name Win32WindowControl -Namespace Win32Functions -PassThru
    `;

    const processesJson = await runPowerShellData(`Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Depth 1`);
    let processes = [];
    try { processes = JSON.parse(processesJson) || []; } catch (e) { }
    if (!Array.isArray(processes)) processes = [processes];

    let targetProc = findBestMatch(targetName, processes, 'ProcessName') || findBestMatch(targetName, processes, 'MainWindowTitle');

    if (targetProc) {
        const handle = targetProc.MainWindowHandle;
        const pid = targetProc.Id;

        // NUCLEAR OPTION: The "Wiggle" Technique
        await runPowerShell(`
            ${windowApi}
            $ws = New-Object -ComObject WScript.Shell
            
            # 1. Force Minimize
            $type::ShowWindowAsync(${handle}, 6)
            Start-Sleep -Milliseconds 200
            
            # 2. Force Restore & Activate
            $type::ShowWindowAsync(${handle}, 9)
            $ws.AppActivate(${pid})
            $type::SetForegroundWindow(${handle})
            $type::SwitchToThisWindow(${handle}, $true)
        `);
        return `Switched to ${targetProc.ProcessName}.`;
    }
    return null;
};

const handleWindowOverrides = async (cleanQuery) => {
    if (cleanQuery.includes('minimize') || cleanQuery.includes('maximize') || cleanQuery.includes('restore') || cleanQuery.includes('show desktop') || cleanQuery.includes('switch')) {

        // ... (API Definition removed as it is now in forceFocusWindow, but we assume it's okay to redefine or we should move it to top level. 
        // Actually, PowerShell sessions are separate per call usually unless we use a persistent runspace, but checking utils/powershell.js shows it spawns new.
        // So safe to redefine.

        const windowApi = `
            $def = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
            $def += '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
            $def += '[DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);'
            $type = Add-Type -MemberDefinition $def -Name Win32WindowControl -Namespace Win32Functions -PassThru
        `;

        if (cleanQuery.includes('desktop')) {
            await runPowerShell(`(New-Object -ComObject Shell.Application).ToggleDesktop()`);
            return "Toggling desktop.";
        }

        // Guess Target
        let searchTarget = "";
        const words = cleanQuery.split(' ');
        let verbIndex = words.findIndex(w => w.includes('switch') || w.includes('minimize') || w.includes('maximize'));
        if (verbIndex !== -1) {
            if (words[verbIndex] === 'switch' && words[verbIndex + 1] === 'to') verbIndex++;
            if (words[verbIndex + 1]) searchTarget = words.slice(verbIndex + 1).join(' ');
        }

        // Check for "Minimize All" Explicitly
        if (cleanQuery.includes('minimize all') || cleanQuery.includes('minimize everything') || searchTarget === 'all' || searchTarget === 'everything') {
            await runPowerShell(`(New-Object -ComObject Shell.Application).MinimizeAll()`);
            return "Minimized all windows.";
        }

        if (cleanQuery.trim() === 'minimize' && !searchTarget) {
            await runPowerShell(`(New-Object -ComObject Shell.Application).MinimizeAll()`);
            return "Minimized all.";
        }

        if (searchTarget) {
            // For simple Switch, use the new helper
            if (cleanQuery.includes('switch') || cleanQuery.includes('focus')) {
                const result = await forceFocusWindow(searchTarget);
                if (result) return result;
                return `App "${searchTarget}" is not running.`;
            }

            // For Min/Max, keep existing logic for now or refactor later.
            // ... (Duplicate Process Fetch for Min/Max just to be safe/granular)
            const processesJson = await runPowerShellData(`Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Depth 1`);
            let processes = [];
            try { processes = JSON.parse(processesJson) || []; } catch (e) { }
            if (!Array.isArray(processes)) processes = [processes];

            let targetProc = findBestMatch(searchTarget, processes, 'ProcessName') || findBestMatch(searchTarget, processes, 'MainWindowTitle');

            if (targetProc) {
                const handle = targetProc.MainWindowHandle;

                if (cleanQuery.includes('minimize')) {
                    await runPowerShell(`${windowApi} $type::ShowWindowAsync(${handle}, 6)`);
                    return `Minimized ${targetProc.ProcessName}.`;
                }
                if (cleanQuery.includes('maximize') || cleanQuery.includes('restore')) {
                    await runPowerShell(`${windowApi} $type::ShowWindowAsync(${handle}, 3); $type::SetForegroundWindow(${handle})`);
                    return `Maximized ${targetProc.ProcessName}.`;
                }
            } else {
                return `App "${searchTarget}" is not running.`;
            }
        }

        return "Window command incomplete."; // Should technically not hit here if logic matches
    }
    return null;
};

const executeWindowAction = async (target, action) => {
    return await handleWindowOverrides(`switch to ${target}`);
};

module.exports = { handleWindowOverrides, executeWindowAction, forceFocusWindow };

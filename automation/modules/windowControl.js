// ==============================
// WINDOW CONTROL MODULE
// ==============================
// Manages application windows: Switching focus, Minimizing, Maximizing, and "Show Desktop".
// Uses complex PowerShell scripts to interact with the Windows User32.dll API.

const { runPowerShell, runPowerShellData } = require('../utils/powershell'); // PS Runners
const { findBestMatch } = require('../utils/matching'); // Fuzzy Matching

/**
 * Force Focus Window (The "Nuclear Option")
 * Switching windows in Windows 10/11 is surprisingly hard due to OS restrictions.
 * We use a "Wiggle" technique (Minimize -> Restore) to force the OS to give focus.
 * 
 * @param {string} targetName - The name of the process or window title to focus.
 */
const forceFocusWindow = async (targetName) => {
    // Define C# Code to access low-level Windows API (User32.dll)
    // This allows PowerShell to call functions like ShowWindowAsync and SetForegroundWindow.
    const windowApi = `
        $def = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
        $def += '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
        $def += '[DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);'
        $type = Add-Type -MemberDefinition $def -Name Win32WindowControl -Namespace Win32Functions -PassThru
    `;

    // Get list of all open windows with a title.
    // We filter out background processes (MainWindowTitle != "")
    const processesJson = await runPowerShellData(`Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Depth 1`);

    // Parse JSON output from PowerShell
    let processes = [];
    try {
        processes = JSON.parse(processesJson) || [];
    } catch (e) { }

    // PowerShell returns a single object if only one result, assume array for safety
    if (!Array.isArray(processes)) processes = [processes];

    // Fuzzy Match the target name against Process Names (e.g., "spotify") AND Window Titles (e.g., "Spotify Free")
    let targetProc = findBestMatch(targetName, processes, 'ProcessName') || findBestMatch(targetName, processes, 'MainWindowTitle');

    if (targetProc) {
        const handle = targetProc.MainWindowHandle; // Window ID
        const pid = targetProc.Id;                 // Process ID

        // Execute the "Wiggle" Technique
        await runPowerShell(`
            ${windowApi}
            $ws = New-Object -ComObject WScript.Shell
            
            # 1. Force Minimize (SW_MINIMIZE = 6)
            # This "wakes up" the window state if it was stuck.
            $type::ShowWindowAsync(${handle}, 6)
            Start-Sleep -Milliseconds 200
            
            # 2. Force Restore (SW_RESTORE = 9)
            # This brings it back to normal size.
            $type::ShowWindowAsync(${handle}, 9)
            
            # 3. Activate
            # Tell WScript Shell to activate the PID
            $ws.AppActivate(${pid})
            
            # 4. Set Foreground & Switch
            # Call Native API to force it to front
            $type::SetForegroundWindow(${handle})
            $type::SwitchToThisWindow(${handle}, $true)
        `);
        return `Switched to ${targetProc.ProcessName}.`;
    }
    return null; // Window not found
};

/**
 * Handle Window Overrides (Minimize All, Desktop, etc.)
 * @param {string} cleanQuery - Normalized user input.
 */
const handleWindowOverrides = async (cleanQuery) => {
    // Check for window management keywords
    if (cleanQuery.includes('minimize') || cleanQuery.includes('maximize') || cleanQuery.includes('restore') || cleanQuery.includes('show desktop') || cleanQuery.includes('switch')) {

        // Define API again for this scope (required for Min/Max operations)
        const windowApi = `
            $def = '[DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);'
            $def += '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);'
            $def += '[DllImport("user32.dll")] public static extern void SwitchToThisWindow(IntPtr hWnd, bool fAltTab);'
            $type = Add-Type -MemberDefinition $def -Name Win32WindowControl -Namespace Win32Functions -PassThru
        `;

        // Action: Show Desktop
        if (cleanQuery.includes('desktop')) {
            // Uses Shell.Application COM Object to toggle desktop
            await runPowerShell(`(New-Object -ComObject Shell.Application).ToggleDesktop()`);
            return "Toggling desktop.";
        }

        // Action: Minimize All
        if (cleanQuery.includes('minimize all') || cleanQuery.includes('minimize everything')) {
            await runPowerShell(`(New-Object -ComObject Shell.Application).MinimizeAll()`);
            return "Minimized all windows.";
        }

        // Logic to extract Target from "Switch to [Target]" or "Minimize [Target]"
        let searchTarget = "";
        const words = cleanQuery.split(' ');
        let verbIndex = words.findIndex(w => w.includes('switch') || w.includes('minimize') || w.includes('maximize'));

        if (verbIndex !== -1) {
            // If "switch to", skip "to"
            if (words[verbIndex] === 'switch' && words[verbIndex + 1] === 'to') verbIndex++;
            // The rest of the string is the target name
            if (words[verbIndex + 1]) searchTarget = words.slice(verbIndex + 1).join(' ');
        }

        // Fallback: If just "minimize" with no target, minimize everything
        if (cleanQuery.trim() === 'minimize' && !searchTarget) {
            await runPowerShell(`(New-Object -ComObject Shell.Application).MinimizeAll()`);
            return "Minimized all.";
        }

        if (searchTarget) {
            // Action: Switch / Focus
            if (cleanQuery.includes('switch') || cleanQuery.includes('focus')) {
                const result = await forceFocusWindow(searchTarget);
                if (result) return result;
                return `App "${searchTarget}" is not running.`;
            }

            // Action: Minimize / Maximize Specific App
            // Re-fetch processes to find the handle
            const processesJson = await runPowerShellData(`Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Id, ProcessName, MainWindowTitle, MainWindowHandle | ConvertTo-Json -Depth 1`);
            let processes = [];
            try { processes = JSON.parse(processesJson) || []; } catch (e) { }
            if (!Array.isArray(processes)) processes = [processes];

            let targetProc = findBestMatch(searchTarget, processes, 'ProcessName') || findBestMatch(searchTarget, processes, 'MainWindowTitle');

            if (targetProc) {
                const handle = targetProc.MainWindowHandle;

                if (cleanQuery.includes('minimize')) {
                    // SW_MINIMIZE = 6
                    await runPowerShell(`${windowApi} $type::ShowWindowAsync(${handle}, 6)`);
                    return `Minimized ${targetProc.ProcessName}.`;
                }
                if (cleanQuery.includes('maximize') || cleanQuery.includes('restore')) {
                    // SW_MAXIMIZE = 3
                    await runPowerShell(`${windowApi} $type::ShowWindowAsync(${handle}, 3); $type::SetForegroundWindow(${handle})`);
                    return `Maximized ${targetProc.ProcessName}.`;
                }
            } else {
                return `App "${searchTarget}" is not running.`;
            }
        }

        return "Window command incomplete.";
    }
    return null;
};

// Wrapper for Main Execution
const executeWindowAction = async (target, action) => {
    // Determine context based on action
    if (action === 'show_desktop') return await handleWindowOverrides('show desktop');
    return await handleWindowOverrides(`switch to ${target}`);
};

module.exports = { handleWindowOverrides, executeWindowAction, forceFocusWindow };

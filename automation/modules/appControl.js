// ==============================
// APP CONTROL MODULE
// ==============================
// Handles launching, closing, and managing installed applications.
// Uses PowerShell to interact with the Windows Start Menu and Processes.

const { runPowerShell, runPowerShellData } = require('../utils/powershell'); // PS Executors
const { findBestMatch } = require('../utils/matching');   // Fuzzy String Matching
const { forceFocusWindow } = require('./windowControl');  // Window Focus Helper

// Cache for the list of installed apps to avoid slow PowerShell calls on every request.
let appCache = null;

// Manual Alias Map
// Maps common user nicknames to the official Window App Names.
const APP_ALIASES = {
    'vscode': 'Visual Studio Code',
    'vs code': 'Visual Studio Code',
    'code': 'Visual Studio Code',
    'visual studio': 'Visual Studio Code',
    'edge': 'Microsoft Edge',
    'chrome': 'Google Chrome',
    'file explorer': 'explorer',
    'explorer': 'explorer',
    'my computer': 'explorer',
    'this pc': 'explorer',
    'notepad': 'Notepad',
    'cmd': 'cmd',
    'terminal': 'Terminal',
    'powershell': 'PowerShell',
    'calculator': 'Calculator',
    'settings': 'Settings',
    'spotify': 'Spotify'
};

/**
 * Executes Application Actions (Open, Close, Restart)
 * @param {string} target - The name of the app (e.g., "notepad").
 * @param {string} action - The action to perform (e.g., "open", "close").
 */
const executeAppAction = async (target, action) => {
    // 1. Resolve Target Name via Alias
    // Check if user said "vscode" and map it to "Visual Studio Code"
    let searchTarget = APP_ALIASES[target] || target;

    // Special Case: Windows File Explorer
    // Explorer is special because it's part of the shell, so we launch it directly.
    if (searchTarget === 'explorer') {
        await runPowerShell('Start-Process "explorer"');
        return "Opening File Explorer.";
    }

    // Special Case: DIVA Assistant (Internal App)
    if (searchTarget === 'diva assistant' || searchTarget === 'diva') {
        // Just find and focus the actual DIVA window instead of failing due to it missing in StartApps
        const appRes = await forceFocusWindow("DIVA Assistant");
        return appRes || "DIVA Assistant is already active.";
    }

    // 2. Build App Cache (If Empty)
    // Runs PowerShell to get a list of all installed Start Menu apps.
    if (!appCache) {
        // 'Get-StartApps' retrieves Name and AppID (AUMID)
        const json = await runPowerShellData(`Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Depth 1`);
        try {
            appCache = JSON.parse(json);
        } catch (e) {
            appCache = [];
        }

        // Manually inject common apps that might be missing or hard to find
        appCache.push({ Name: "Visual Studio Code", AppID: "code" });
        appCache.push({ Name: "Google Chrome", AppID: "chrome" });
        appCache.push({ Name: "Microsoft Edge", AppID: "msedge" });
    }

    // 3. Smart Fuzzy Match
    // Matches "spotfi" -> "Spotify" using Levenshtein distance.
    const bestApp = findBestMatch(searchTarget, appCache, 'Name');

    // --- GET TRUE PROCESS NAME ---
    // Target might be "Google Chrome" but process name is "chrome"
    const lookupName = bestApp ? bestApp.Name : target;
    let finalProcName = lookupName;
    
    if (action === 'close' || action === 'restart') {
        const processesJson = await runPowerShellData(`Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object ProcessName, MainWindowTitle | ConvertTo-Json -Depth 1`);
        let processes = [];
        try { processes = JSON.parse(processesJson) || []; } catch (e) {}
        if (!Array.isArray(processes)) processes = [processes];

        let targetProc = findBestMatch(lookupName, processes, 'ProcessName') || findBestMatch(lookupName, processes, 'MainWindowTitle');
        if (targetProc) {
            finalProcName = targetProc.ProcessName;
        }
    }

    // --- ACTION: CLOSE APP ---
    if (action === 'close') {
        // Stop-Process kills the app. -Force ensures it closes. SilentlyContinue ignores errors if not running.
        await runPowerShell(`Stop-Process -Name "${finalProcName}" -Force -ErrorAction SilentlyContinue`);
        // Special case: UWP Apps like Calculator might leave background processes, try killing by ID if we had one, but Name usually works.
        return `Closing ${finalProcName}.`;
    }

    // --- ACTION: RESTART APP ---
    if (action === 'restart') {
        // Kill it first
        await runPowerShell(`Stop-Process -Name "${finalProcName}" -Force -ErrorAction SilentlyContinue`);
        // Wait 1.5s to ensure it's fully dead
        await new Promise(r => setTimeout(r, 1500));
        // Code execution falls through to "Open" logic below...
    }

    // --- ACTION: OPEN APP ---
    if (bestApp) {
        console.log(`Found App: ${bestApp.Name} (${bestApp.AppID})`);

        // OPTIMIZATION: Check if already running first!
        // If running, just switch focus to it instead of spawning a new instance.
        const switchResult = await forceFocusWindow(bestApp.Name);
        if (switchResult) {
            return switchResult; // Returns "Switched to X"
        }

        // If not running, Launch it using Start-Process
        // logic to handle UWP Apps (AppID contains '!') vs Standard Exe
        if (bestApp.AppID.includes('!') || bestApp.AppID.includes('.')) {
            // Launch UWP App (like Calculator, Photos)
            await runPowerShell(`Start-Process "shell:AppsFolder\\${bestApp.AppID}"`);
        } else {
            // Launch Standard App (like Chrome, Code)
            await runPowerShell(`Start-Process "${bestApp.AppID}"`);
        }

        // Post-Launch Focus Attempt
        // Wait 1.5s for window to appear, then force focus to it.
        await new Promise(r => setTimeout(r, 1500));
        await forceFocusWindow(bestApp.Name);

        return `Opening ${bestApp.Name}.`;
    } else {
        // --- FALLBACK: GENERIC EXECUTION ---
        // If not in Start Menu, maybe it's a direct file path or command?

        // Check if it looks like a Web URL or Domain (e.g., spotify.com/nilapakshikal)
        // We explicitly reject it so it falls back to 'webControl'
        const isUrl = searchTarget.includes('.') && !searchTarget.includes(' ') && !searchTarget.includes('\\') && !searchTarget.includes(':\\') && !searchTarget.endsWith('.exe');
        if (isUrl || searchTarget.startsWith('http')) {
            return null; // Route to Web Control
        }

        // Check if it looks like a file path (C:\..., /path/to/script.sh)
        if (searchTarget.includes('\\') || searchTarget.includes('/') || searchTarget.includes(':')) {
            const success = await runPowerShell(`Start-Process "${searchTarget}"`);
            if (success) {
                return `Opening ${searchTarget}.`;
            } else {
                return null; // Route to Web Control if path execution fails
            }
        }

        // If it's just a random word like "Banana", return null.
        // The main index.js will see this null and route it to Web Search instead.
        return null;
    }
};

module.exports = { executeAppAction };

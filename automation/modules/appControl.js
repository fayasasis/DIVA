const { runPowerShell, runPowerShellData } = require('../utils/powershell');
const { findBestMatch } = require('../utils/matching');
const { forceFocusWindow } = require('./windowControl');

let appCache = null;

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

const executeAppAction = async (target, action) => {
    // 1. Resolve Target via Alias
    let searchTarget = APP_ALIASES[target] || target;

    // Special Case: Explorer
    if (searchTarget === 'explorer') {
        await runPowerShell('Start-Process "explorer"');
        return "Opening File Explorer.";
    }

    // 2. Fetch Apps if not cached
    if (!appCache) {
        const json = await runPowerShellData(`Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Depth 1`);
        try { appCache = JSON.parse(json); } catch (e) { appCache = []; }
        appCache.push({ Name: "Visual Studio Code", AppID: "code" });
        appCache.push({ Name: "Google Chrome", AppID: "chrome" });
        appCache.push({ Name: "Microsoft Edge", AppID: "msedge" });
    }

    // 3. Smart Match
    const bestApp = findBestMatch(searchTarget, appCache, 'Name');

    // Close
    if (action === 'close') {
        const procName = bestApp ? bestApp.Name : target;
        await runPowerShell(`Stop-Process -Name "${procName}" -Force -ErrorAction SilentlyContinue`);
        return `Closing ${procName}.`;
    }

    // Restart logic (Simple)
    if (action === 'restart') {
        const procName = bestApp ? bestApp.Name : target;
        await runPowerShell(`Stop-Process -Name "${procName}" -Force -ErrorAction SilentlyContinue`);
        await new Promise(r => setTimeout(r, 1500));
        // Falls through to Open
    }

    // Open
    if (bestApp) {
        console.log(`Found App: ${bestApp.Name} (${bestApp.AppID})`);
        if (bestApp.AppID.includes('!') || bestApp.AppID.includes('.')) {
            await runPowerShell(`Start-Process "shell:AppsFolder\\${bestApp.AppID}"`);
        } else {
            await runPowerShell(`Start-Process "${bestApp.AppID}"`);
        }

        // AGGRESSIVE FOCUS FOR NEWLY OPENED APP
        await new Promise(r => setTimeout(r, 1500));
        await forceFocusWindow(bestApp.Name);

        return `Opening ${bestApp.Name}.`;
    } else {
        // Fallback: Check if it's a file path or known command
        // If it contains path separators, try opening it as a generic path
        if (searchTarget.includes('\\') || searchTarget.includes('/') || searchTarget.includes(':')) {
            try {
                await runPowerShell(`Start-Process "${searchTarget}"`);
                return `Opening ${searchTarget}.`;
            } catch (e) {
                return `Could not find "${target}".`;
            }
        }

        // If it's just a random word like "BlahBlah", return null so index.js can send it to Web Search
        return null;
    }
};

module.exports = { executeAppAction };

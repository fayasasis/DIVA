// ==============================
// FILE CONTROL MODULE
// ==============================
// Handles file system operations: Creating, Deleting, Listing, Renaming, and Opening files/folders.
// Uses Node.js 'fs' for checks and PowerShell for execution (to handle permissions/legacy support).

const { runPowerShell } = require('../utils/powershell'); // PS Runner
const path = require('path'); // Path manipulation
const fs = require('fs');     // Node.js File System
const os = require('os');     // OS user directory info

/**
 * Intelligent Path Resolution
 * converts "Desktop", "Downloads", "My Documents" into absolute system paths.
 * 
 * @param {string} userPath - The path or folder name typed by the user.
 * @returns {string} - The absolute path.
 */
const resolvePath = (userPath) => {
    const homedir = os.homedir(); // e.g., C:\Users\Fayas

    // Default: Return Desktop if input is empty
    if (!userPath) {
        const oneDriveDesktop = path.join(homedir, 'OneDrive', 'Desktop');
        if (fs.existsSync(oneDriveDesktop)) return oneDriveDesktop;
        return path.join(homedir, 'Desktop');
    }

    // 1. Check if it's already an Absolute Path (e.g., "C:\Users\test")
    if (path.isAbsolute(userPath)) return userPath;
    if (/^[A-Za-z]:$/.test(userPath)) return userPath + "\\"; // Handle drive letters "E:"

    // 2. Map Special Keyword Folders with Sub-path support
    const baseFolders = {
        'desktop': fs.existsSync(path.join(homedir, 'OneDrive', 'Desktop')) 
            ? path.join(homedir, 'OneDrive', 'Desktop') 
            : path.join(homedir, 'Desktop'),
        'download': path.join(homedir, 'Downloads'),
        'document': path.join(homedir, 'Documents'),
        'picture': path.join(homedir, 'Pictures'),
        'video': path.join(homedir, 'Videos'),
        'movie': path.join(homedir, 'Videos'),
        'music': path.join(homedir, 'Music')
    };

    const lower = userPath.toLowerCase().trim();
    
    // Check if the input starts with a known folder keyword
    for (const [keyword, baseDir] of Object.entries(baseFolders)) {
        // Match "desktop", "desktop/file.txt", or "desktop\file.txt"
        if (lower === keyword || lower.startsWith(keyword + '/') || lower.startsWith(keyword + '\\')) {
            const subPath = userPath.slice(keyword.length).replace(/^[\\\/]+/, '');
            return path.join(baseDir, subPath);
        }
    }

    // 3. Fallback: Treat as relative path on Desktop
    // e.g., "Divaproject" -> "C:\Users\Fayas\Desktop\Divaproject"
    const baseDesktop = baseFolders['desktop'];
    return path.join(baseDesktop, userPath);
};

// Main Execution Function
const executeFileAction = async (target, action, entities, rawIntent, rawQuery = "") => {
    try {
        console.log(`File Action: ${action} | Target: ${target}`);

        // Resolve the primary target path
        // Priority: entities.path > target > entities.source > Default "New_Folder"
        let targetPath = resolvePath(entities.path || target || entities.source || "New_Folder");

        // Handle composite actions: "Create [target] in [destination]"
        if (action.includes('create') && entities.destination) {
            targetPath = path.join(resolvePath(entities.destination), target || entities.source || "New_Folder");
        }

        // --- ACTION 1: CREATE ---
        if (action.includes('create') || action === 'make') {
            // Determine if File or Directory based on extension (simple heuristic)
            const itemType = (entities.type === 'file' || target.includes('.')) ? 'File' : 'Directory';

            // PowerShell: New-Item
            // -Force allows overwriting strictness (but usually won't overwrite existing content unless specifed)
            const ps = `New-Item -Path "${targetPath}" -ItemType ${itemType} -Force -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Created ${itemType} at "${targetPath}"`;
        }

        // --- ACTION 2: DELETE ---
        if (action.includes('delete') || action.includes('remove')) {
            // PowerShell: Remove-Item
            // -Recurse deletes subfolders. -Force deletes read-only.
            const ps = `Remove-Item -Path "${targetPath}" -Recurse -Force -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Deleted "${targetPath}"`;
        }

        // --- ACTION 3: LIST CONTENTS / OPEN ---
        if (action.includes('list') || action.includes('open')) {
            if (!fs.existsSync(targetPath)) return `Path not found: ${targetPath}`;

            // Case A: It's a File -> Launch it
            if (fs.lstatSync(targetPath).isFile()) {
                await runPowerShell(`Invoke-Item "${targetPath}"`); // Equivalent to double-clicking
                return `Opened ${targetPath}`;
            }

            // Case B: It's a Folder -> List Files
            // Get first 20 items to avoid flooding chat
            const ps = `Get-ChildItem -Path "${targetPath}" -Name | Select-Object -First 20`;
            const output = await runPowerShell(ps);
            // Format output as comma-separated string
            const files = output.replace(/\r\n/g, ", ").trim();
            return `Contents of ${path.basename(targetPath)}: ${files}`;
        }

        // --- ACTION 4: RENAME ---
        if (action.includes('rename')) {
            const newName = entities.destination || entities.name;
            if (!newName) return "Please specify a new name.";
            // PowerShell: Rename-Item
            const ps = `Rename-Item -Path "${targetPath}" -NewName "${newName}" -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Renamed to "${newName}"`;
        }

    } catch (err) {
        console.error("File Op Error:", err);
        return `Action failed: ${err.message}`;
    }
    return "Unknown file action.";
};

module.exports = { executeFileAction };

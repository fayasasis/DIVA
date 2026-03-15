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
 * Sanitizes a path string to prevent PowerShell command injection.
 * Escapes backticks, double-quotes, dollar signs, and semicolons.
 *
 * @param {string} inputPath - Raw path string.
 * @returns {string} - Escaped path safe for embedding in PS strings.
 */
const sanitizePath = (inputPath) => {
    if (typeof inputPath !== 'string') return '';
    return inputPath.replace(/[`"$;]/g, (c) => '`' + c);
};

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
        // FIX: was `action === 'make'` which never matched — changed to action.includes('make')
        if (action.includes('create') || action.includes('make')) {
            // Determine if File or Directory based on extension (simple heuristic)
            const itemType = (entities.type === 'file' || target.includes('.')) ? 'File' : 'Directory';
            const safePath = sanitizePath(targetPath);

            // PowerShell: New-Item
            // -Force allows overwriting strictness (but usually won't overwrite existing content unless specified)
            const ps = `New-Item -Path "${safePath}" -ItemType ${itemType} -Force -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Created ${itemType} at "${targetPath}"`;
        }

        // --- ACTION 2: DELETE ---
        if (action.includes('delete') || action.includes('remove')) {
            // PowerShell: Remove-Item
            // -Recurse deletes subfolders. -Force deletes read-only.
            const safePath = sanitizePath(targetPath);
            const ps = `Remove-Item -Path "${safePath}" -Recurse -Force -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Deleted "${targetPath}"`;
        }

        // --- ACTION 3: LIST CONTENTS / OPEN ---
        if (action.includes('list') || action.includes('open')) {
            if (!fs.existsSync(targetPath)) return `Path not found: ${targetPath}`;

            // FIX: lstatSync can throw on permission errors — wrapped in try/catch
            let stat;
            try {
                stat = fs.lstatSync(targetPath);
            } catch (e) {
                return `Cannot access "${targetPath}": ${e.message}`;
            }

            // Case A: It's a File -> Launch it
            if (stat.isFile()) {
                // FIX: path was not sanitized before being passed to PowerShell
                await runPowerShell(`Invoke-Item "${sanitizePath(targetPath)}"`);
                return `Opened ${targetPath}`;
            }

            // Case B: It's a Folder -> List Files
            // Get first 20 items to avoid flooding chat
            const safePath = sanitizePath(targetPath);
            const ps = `Get-ChildItem -Path "${safePath}" -Name | Select-Object -First 20`;
            const output = await runPowerShell(ps);
            // Format output as comma-separated string
            const files = output.replace(/\r\n/g, ", ").trim();
            return `Contents of ${path.basename(targetPath)}: ${files}`;
        }

        // --- ACTION 4: RENAME ---
        if (action.includes('rename')) {
            const newName = entities.destination || entities.name;
            if (!newName) return "Please specify a new name.";
            const safePath = sanitizePath(targetPath);
            const safeName = sanitizePath(newName);
            // PowerShell: Rename-Item
            const ps = `Rename-Item -Path "${safePath}" -NewName "${safeName}" -ErrorAction Stop`;
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
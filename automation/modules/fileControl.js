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
 */
const sanitizePath = (inputPath) => {
    if (typeof inputPath !== 'string') return '';
    return inputPath.replace(/[`"$;]/g, (c) => '`' + c);
};

/**
 * Converts keyword folder names into absolute system paths.
 * Supports both singular and plural forms (e.g. "download" and "downloads").
 */
const resolvePath = (userPath) => {
    const homedir = os.homedir();

    if (!userPath) return path.join(homedir, 'Desktop');
    if (path.isAbsolute(userPath)) return userPath;
    if (/^[A-Za-z]:$/.test(userPath)) return userPath + "\\";

    const baseFolders = {
        'desktop':   path.join(homedir, 'Desktop'),
        'download':  path.join(homedir, 'Downloads'),
        'downloads': path.join(homedir, 'Downloads'),
        'document':  path.join(homedir, 'Documents'),
        'documents': path.join(homedir, 'Documents'),
        'picture':   path.join(homedir, 'Pictures'),
        'pictures':  path.join(homedir, 'Pictures'),
        'video':     path.join(homedir, 'Videos'),
        'videos':    path.join(homedir, 'Videos'),
        'movie':     path.join(homedir, 'Videos'),
        'movies':    path.join(homedir, 'Videos'),
        'music':     path.join(homedir, 'Music'),
    };

    const lower = userPath.toLowerCase().trim();

    for (const [keyword, baseDir] of Object.entries(baseFolders)) {
        if (lower === keyword || lower.startsWith(keyword + '/') || lower.startsWith(keyword + '\\')) {
            const subPath = userPath.slice(keyword.length).replace(/^[\\\/]+/, '');
            return path.join(baseDir, subPath);
        }
    }

    return path.join(homedir, 'Desktop', userPath);
};

/**
 * Case-insensitive + extension-aware path correction.
 * If the exact path doesn't exist on disk, scans the parent directory for a
 * file/folder whose name matches ignoring case or missing extension.
 * e.g. "meenakshi" → "Meenakshi.pdf", "devi" → "Devi"
 */
const resolveRealPath = (p) => {
    if (fs.existsSync(p)) return p;

    const dir = path.dirname(p);
    const name = path.basename(p).toLowerCase();

    if (!fs.existsSync(dir)) return p;

    const entries = fs.readdirSync(dir);
    const match = entries.find(e =>
        e.toLowerCase() === name ||
        path.parse(e).name.toLowerCase() === name
    );

    return match ? path.join(dir, match) : p;
};

/**
 * Central path resolver for EXISTING files/folders (delete, open, list, rename).
 * Checks entities.path → entities.destination → entities.location → Desktop fallback.
 * Then corrects casing and missing extensions against what's on disk.
 */
const resolveTargetPath = (t, entities) => {
    let p;

    if (entities.path) {
        p = resolvePath(entities.path);
    } else if (entities.destination) {
        p = path.join(resolvePath(entities.destination), t);
    } else if (entities.location) {
        p = path.join(resolvePath(entities.location), t);
    } else {
        p = resolvePath(t);
    }

    return resolveRealPath(p);
};

/**
 * Path resolver for NEW files/folders (create only).
 * Skips resolveRealPath since the file doesn't exist yet.
 */
const resolveNewPath = (t, entities) => {
    if (entities.path) return resolvePath(entities.path);
    if (entities.destination) return path.join(resolvePath(entities.destination), t);
    if (entities.location) return path.join(resolvePath(entities.location), t);
    return resolvePath(t);
};

/**
 * Extracts the real target name from entities.
 * phi3 is inconsistent — sometimes uses "name", "target", or the raw target param.
 * Filters out generic words like "folder" and "file".
 */
const extractTargetName = (target, entities) => {
    const genericWords = ['folder', 'file', 'directory'];
    const candidates = [
        entities.name,
        entities.target,
        entities.from,
        target
    ];
    for (const c of candidates) {
        if (c && !genericWords.includes(c.toLowerCase().trim())) {
            return c;
        }
    }
    return target;
};

// ==============================
// MAIN EXECUTION FUNCTION
// ==============================
const executeFileAction = async (target, action, entities, rawIntent, rawQuery = "") => {
    try {
        console.log(`File Action: ${action} | Target: ${target}`);
        console.log(`Entities: ${JSON.stringify(entities)}`);

        // --- EXTRACT MULTIPLE TARGETS ---
        let targets = [];
        if (entities.targets && Array.isArray(entities.targets)) {
            targets = entities.targets;
        } else if (target && target.includes(' and ')) {
            targets = target.split(' and ').map(t => t.trim());
        } else if (target) {
            targets = [target];
        } else if (entities.source) {
            targets = [entities.source];
        } else {
            targets = ["New_Folder"];
        }

        // --- ACTION 1: CREATE ---
        if (action.includes('create') || action.includes('make')) {
            let results = [];
            for (const t of targets) {
                let realName = extractTargetName(t, entities);

                // If type is file but no extension given, default to .txt
                if (entities.type === 'file' && !realName.includes('.')) {
                    realName = realName + '.txt';
                }

                const p = resolveNewPath(realName, entities);
                const itemType = (entities.type === 'file' || realName.includes('.')) ? 'File' : 'Directory';
                console.log(`[CREATE] Resolved path: "${p}" | Type: ${itemType}`);
                const ps = `New-Item -Path "${sanitizePath(p)}" -ItemType ${itemType} -Force -ErrorAction Stop`;
                const result = await runPowerShell(ps);
                console.log(`[CREATE] PowerShell result:`, result);
                results.push(`"${p}"`);
            }
            return `Created ${results.join(', ')}`;
        }

        // --- ACTION 2: DELETE ---
        if (action.includes('delete') || action.includes('remove')) {
            let results = [];
            for (const t of targets) {
                const p = resolveTargetPath(t, entities);
                console.log(`[DELETE] Resolved path: "${p}"`);
                const ps = `Remove-Item -Path "${sanitizePath(p)}" -Recurse -Force -ErrorAction Stop`;
                const result = await runPowerShell(ps);
                console.log(`[DELETE] PowerShell result:`, result);
                results.push(`"${p}"`);
            }
            return `Deleted ${results.join(', ')}`;
        }

        // --- ACTION 3: LIST CONTENTS / OPEN ---
        if (action.includes('list') || action.includes('open')) {
            const t = extractTargetName(targets[0], entities);
            const p = resolveTargetPath(t, entities);
            console.log(`[OPEN/LIST] Resolved path: "${p}"`);

            if (!fs.existsSync(p)) return `Path not found: "${p}"`;

            let stat;
            try {
                stat = fs.lstatSync(p);
            } catch (e) {
                return `Cannot access "${p}": ${e.message}`;
            }

            if (stat.isFile()) {
                const result = await runPowerShell(`Invoke-Item "${sanitizePath(p)}"`);
                console.log(`[OPEN] PowerShell result:`, result);
                return `Opened "${p}"`;
            }

            const ps = `Get-ChildItem -Path "${sanitizePath(p)}" -Name | Select-Object -First 20`;
            const output = await runPowerShell(ps);
            console.log(`[LIST] PowerShell result:`, output);
            const files = (output || '').toString().replace(/\r\n/g, ", ").trim();
            return `Contents of "${path.basename(p)}": ${files}`;
        }

        // --- ACTION 4: RENAME ---
        if (action.includes('rename')) {
            const sourceName = entities.from || entities.target || targets[0];
            const newName = entities.to || entities.new_name || entities.name;
            if (!newName) return "Please specify a new name.";

            const p = resolveTargetPath(sourceName, entities);
            console.log(`[RENAME] Resolved path: "${p}"`);

            const ps = `Rename-Item -Path "${sanitizePath(p)}" -NewName "${sanitizePath(newName)}" -ErrorAction Stop`;
            const result = await runPowerShell(ps);
            console.log(`[RENAME] PowerShell result:`, result);
            return `Renamed "${sourceName}" to "${newName}"`;
        }

    } catch (err) {
        console.error("File Op Error:", err);
        return `Action failed: ${err.message}`;
    }
    return "Unknown file action.";
};

module.exports = { executeFileAction };
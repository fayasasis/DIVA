const { runPowerShell } = require('../utils/powershell');
const path = require('path');
const fs = require('fs');
const os = require('os');

// --- HELPER: RESOLVE PATH ---
// Simple, stateless path resolution.
// Defaults to Desktop if no path provided.
const resolvePath = (userPath) => {
    const homedir = os.homedir();

    // Default to Desktop
    if (!userPath) {
        // Check OneDrive
        const oneDriveDesktop = path.join(homedir, 'OneDrive', 'Desktop');
        if (fs.existsSync(oneDriveDesktop)) return oneDriveDesktop;
        return path.join(homedir, 'Desktop');
    }

    const lower = userPath.toLowerCase().trim();

    // 1. Absolute Paths
    if (path.isAbsolute(userPath)) return userPath;
    if (/^[A-Za-z]:$/.test(userPath)) return userPath + "\\";

    // 2. Special Folders
    if (lower.includes('desktop')) {
        const oneDrive = path.join(homedir, 'OneDrive', 'Desktop');
        return fs.existsSync(oneDrive) ? oneDrive : path.join(homedir, 'Desktop');
    }
    if (lower.includes('download')) return path.join(homedir, 'Downloads');
    if (lower.includes('document')) return path.join(homedir, 'Documents');
    if (lower.includes('picture')) return path.join(homedir, 'Pictures');
    if (lower.includes('video') || lower.includes('movie')) return path.join(homedir, 'Videos');
    if (lower.includes('music')) return path.join(homedir, 'Music');

    // 3. Fallback: Resolve relative to Desktop
    const baseDesktop = fs.existsSync(path.join(homedir, 'OneDrive', 'Desktop'))
        ? path.join(homedir, 'OneDrive', 'Desktop')
        : path.join(homedir, 'Desktop');

    return path.join(baseDesktop, userPath);
};

const executeFileAction = async (target, action, entities, rawIntent, rawQuery = "") => {
    try {
        console.log(`📂 File Action: ${action} | Target: ${target}`);

        // Resolve Target Path
        let targetPath = resolvePath(entities.path || target || entities.source || "New_Folder");

        // Handle "Create X in Y"
        if (action.includes('create') && entities.destination) {
            targetPath = path.join(resolvePath(entities.destination), target || entities.source || "New_Folder");
        }

        // --- 1. CREATE ---
        if (action.includes('create') || action === 'make') {
            const itemType = (entities.type === 'file' || target.includes('.')) ? 'File' : 'Directory';

            // If the target path identifies an existing directory, we append the name
            // BUT since this is the simple version, we assume targetPath IS the full path

            const ps = `New-Item -Path "${targetPath}" -ItemType ${itemType} -Force -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Created ${itemType} at "${targetPath}"`;
        }

        // --- 2. DELETE ---
        if (action.includes('delete') || action.includes('remove')) {
            const ps = `Remove-Item -Path "${targetPath}" -Recurse -Force -ErrorAction Stop`;
            await runPowerShell(ps);
            return `Deleted "${targetPath}"`;
        }

        // --- 3. LIST / OPEN ---
        if (action.includes('list') || action.includes('open')) {
            if (!fs.existsSync(targetPath)) return `Path not found: ${targetPath}`;

            // If it's a file, we "Invoke-Item" to open it
            if (fs.lstatSync(targetPath).isFile()) {
                await runPowerShell(`Invoke-Item "${targetPath}"`);
                return `Opened ${targetPath}`;
            }

            // If directory, list contents
            const ps = `Get-ChildItem -Path "${targetPath}" -Name | Select-Object -First 20`;
            const output = await runPowerShell(ps);
            const files = output.replace(/\r\n/g, ", ").trim();
            return `Contents of ${path.basename(targetPath)}: ${files}`;
        }

        // --- 4. RENAME ---
        if (action.includes('rename')) {
            const newName = entities.destination || entities.name;
            if (!newName) return "Please specify a new name.";
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

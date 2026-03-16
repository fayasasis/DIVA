const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend/database.sqlite');
const db = new sqlite3.Database(dbPath);

function normalize(title) {
    if (!title) return null;
    const lower = title.toLowerCase();
    if (lower.includes("visual studio code") || lower.includes("vs code")) return "Visual Studio Code";
    if (lower.includes("google chrome") || lower.includes("chrome")) return "Google Chrome";
    if (lower.includes("microsoft edge") || lower.includes("edge")) return "Microsoft Edge";
    if (lower.includes("spotify")) return "Spotify";
    if (lower.includes("calculator")) return "Calculator";
    if (lower.includes("notepad")) return "Notepad";
    if (lower.includes("diva")) return "DIVA Assistant";
    return title.split(' - ').pop();
}

db.all("SELECT DISTINCT action_value FROM activity_logs WHERE action_type='APP_FOCUS'", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("Distinct App Focus values in DB:");
    rows.forEach(row => {
        const norm = normalize(row.action_value);
        console.log(`- Raw: "${row.action_value}" | Normalized: "${norm}"`);
    });
    db.close();
});

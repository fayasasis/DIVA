const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not open database', err);
        return;
    }
    console.log('Connected to database');
});

db.serialize(() => {
    db.all("SELECT name FROM sqlite_master WHERE type='table';", [], (err, tables) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Tables:', tables);

        // Check columns of Sessions
        db.all("PRAGMA table_info(Sessions);", [], (err, columns) => {
            if (err) console.error("Error getting info for Sessions", err);
            else console.log("Sessions columns:", columns);
        });

        // Check if Sessions_backup exists
        if (tables.find(t => t.name === 'Sessions_backup')) {
            console.log("Sessions_backup exists!");
        }

        // Dump Sessions IDs
        db.all("SELECT id FROM Sessions", [], (err, rows) => {
            if (err) console.log("Could not read Sessions", err);
            else {
                console.log(`Sessions count: ${rows.length}`);
                const ids = rows.map(r => r.id);
                const uniqueIds = new Set(ids);
                console.log(`Unique IDs: ${uniqueIds.size}`);
                if (ids.length !== uniqueIds.size) {
                    console.log("DUPLICATE IDS FOUND!");
                    // Find duplicates
                    const counts = {};
                    ids.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
                    console.log("Duplicates:", Object.keys(counts).filter(k => counts[k] > 1));
                }
            }
        });
    });
});

db.close();

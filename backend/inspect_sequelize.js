const sequelize = require('./config/database');
const fs = require('fs');

async function inspect() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const [results] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table';");
        console.log("Tables:", results);

        const sessionsTable = results.find(t => t.name === 'Sessions');
        if (sessionsTable) {
            const [rows] = await sequelize.query("SELECT * FROM Sessions");
            console.log(`Sessions count: ${rows.length}`);

            fs.writeFileSync('db_dump.json', JSON.stringify(rows, null, 2));

            const ids = rows.map(r => r.id);
            const unique = new Set(ids);
            console.log(`Unique IDs: ${unique.size}, Total: ${ids.length}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

inspect();

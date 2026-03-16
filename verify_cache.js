const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'backend/database.sqlite'),
    logging: false
});

async function run() {
    try {
        const [results] = await sequelize.query("SELECT id, text FROM SemanticCaches WHERE id BETWEEN 239 AND 254");
        console.log("Records to delete:");
        results.forEach(row => console.log(`ID: ${row.id} | Text: ${row.text}`));
        
        if (results.length === 0) {
            console.log("No records found in range 239-254.");
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await sequelize.close();
    }
}

run();

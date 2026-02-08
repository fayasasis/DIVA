const sequelize = require('./config/database');

async function clean() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        await sequelize.query("DROP TABLE IF EXISTS Sessions_backup;");
        console.log("Dropped Sessions_backup.");

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}
clean();

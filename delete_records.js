const sequelize = require('./backend/config/database');
const SemanticCache = require('./backend/models/SemanticCache');

async function run() {
    const args = process.argv.slice(2);
    const verifyOnly = args.includes('--verify');
    const execute = args.includes('--execute');
    
    // Parse range from arguments (node delete_records.js 225 --execute)
    const idArgs = args.filter(a => !a.startsWith('--'));
    const startId = parseInt(idArgs[0]);
    let endId = parseInt(idArgs[1]);

    if (isNaN(startId)) {
        console.log('Please provide at least a start ID. Example: node delete_records.js 225 --verify');
        return;
    }

    try {
        await sequelize.authenticate();
        
        let whereClause = {};
        if (isNaN(endId)) {
            console.log(`Checking from ID ${startId} to end...`);
            const { Op } = require('sequelize');
            whereClause = { id: { [Op.gte]: startId } };
        } else {
            console.log(`Checking range ${startId} to ${endId}...`);
            const { Op } = require('sequelize');
            whereClause = { id: { [Op.between]: [startId, endId] } };
        }

        const records = await SemanticCache.findAll({
            where: whereClause,
            attributes: ['id', 'text']
        });

        if (records.length === 0) {
            console.log(`No records found in the specified range.`);
            return;
        }

        console.log(`Found ${records.length} records:`);
        records.forEach(r => console.log(`ID: ${r.id} | Text: ${r.text}`));

        if (execute) {
            console.log('\nDeleting records...');
            const deletedCount = await SemanticCache.destroy({
                where: {
                    id: records.map(r => r.id)
                }
            });
            console.log(`Successfully deleted ${deletedCount} records.`);
        } else if (!verifyOnly) {
            console.log('\nUse --execute to perform the deletion or --verify to just see records.');
        }

    } catch (error) {
        console.error('Unable to connect to the database or processing failed:', error);
    } finally {
        await sequelize.close();
    }
}

run();

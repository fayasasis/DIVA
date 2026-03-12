// ==============================
// SEMANTIC CACHE SEEDER
// ==============================
// Pre-populates the SQLite SemanticCache Database with trained embeddings
// for common system commands. This ensures fast-path execution (zero latency)
// on fresh installations without requiring user training.

const sequelize = require('./config/database');
const SemanticCache = require('./models/SemanticCache');
const { getTextVector } = require('./utils/embedding');

// Define the trained dataset of common commands
const SEED_DATA = [
    {
        text: "open calculator",
        action: { intent: "open_app", entities: { action: "open", target: "calculator" } }
    },
    {
        text: "open notepad",
        action: { intent: "open_app", entities: { action: "open", target: "notepad" } }
    },
    {
        text: "open edge",
        action: { intent: "open_app", entities: { action: "open", target: "edge" } }
    },
    {
        text: "open chrome",
        action: { intent: "open_app", entities: { action: "open", target: "chrome" } }
    },
    {
        text: "play spotify",
        action: { intent: "app_control", entities: { action: "open", target: "spotify" } }
    },
    {
        text: "shutdown computer",
        action: { type: "system_action", entities: { command: "shutdown" } }
    },
    {
        text: "restart computer",
        action: { type: "system_action", entities: { command: "restart system" } }
    },
    {
        text: "lock computer",
        action: { type: "system_action", entities: { command: "lock" } }
    },
    {
        text: "sleep",
        action: { type: "system_action", entities: { command: "sleep" } }
    },
    {
        text: "volume up",
        action: { type: "system_action", entities: { command: "volume up" } }
    },
    {
        text: "volume down",
        action: { type: "system_action", entities: { command: "volume down" } }
    },
    {
        text: "mute volume",
        action: { type: "system_action", entities: { command: "mute" } }
    },
    {
        text: "open file explorer",
        action: { intent: "open_app", entities: { action: "open", target: "explorer" } }
    },
    {
        text: "open vs code",
        action: { intent: "open_app", entities: { action: "open", target: "vscode" } }
    },
    {
        text: "open desktop",
        action: { intent: "file_action", entities: { action: "open", target: "Desktop" } }
    },
    {
        text: "open downloads folder",
        action: { intent: "file_action", entities: { action: "open", target: "Downloads" } }
    },
    {
        text: "open settings",
        action: { intent: "open_app", entities: { action: "open", target: "settings" } }
    },
    {
        text: "open task manager",
        action: { intent: "open_app", entities: { action: "open", target: "task manager" } }
    },
    {
        text: "open command prompt",
        action: { intent: "open_app", entities: { action: "open", target: "cmd" } }
    },
    {
        text: "close calculator",
        action: { intent: "app_control", entities: { action: "close", target: "calculator" } }
    },
    {
        text: "close notepad",
        action: { intent: "app_control", entities: { action: "close", target: "notepad" } }
    },
    {
        text: "close edge",
        action: { intent: "app_control", entities: { action: "close", target: "edge" } }
    },
    {
        text: "close chrome",
        action: { intent: "app_control", entities: { action: "close", target: "chrome" } }
    },
    {
        text: "minimize all windows",
        action: { intent: "window_control", entities: { action: "minimize_all" } }
    },
    {
        text: "show desktop",
        action: { intent: "window_control", entities: { action: "show_desktop" } }
    },
    {
        text: "pause music",
        action: { type: "web_search", intent: "media_control", entities: { action: "pause" } }
    },
    {
        text: "next track",
        action: { type: "web_search", intent: "media_control", entities: { action: "next" } }
    },
    {
        text: "previous track",
        action: { type: "web_search", intent: "media_control", entities: { action: "previous" } }
    },
    {
        text: "increase brightness",
        action: { type: "system_action", entities: { command: "brightness up" } }
    },
    {
        text: "decrease brightness",
        action: { type: "system_action", entities: { command: "brightness down" } }
    },
    {
        text: "empty recycle bin",
        action: { type: "system_action", entities: { command: "empty trash" } }
    },
    {
        text: "open documents folder",
        action: { intent: "file_action", entities: { action: "open", target: "Documents" } }
    },
    {
        text: "open pictures folder",
        action: { intent: "file_action", entities: { action: "open", target: "Pictures" } }
    }
];

async function seedDatabase() {
    console.log("==============================");
    console.log("  DIVA CACHE SEEDER STARTED  ");
    console.log("==============================");

    try {
        // Ensure connection & table exists
        await sequelize.authenticate();
        await SemanticCache.sync(); 
        console.log("✅ Database Connected.");

        let successCount = 0;
        let skipCount = 0;

        for (const item of SEED_DATA) {
            // 1. Check if already exists (prevent duplicate seeding)
            const existing = await SemanticCache.findOne({ where: { text: item.text } });
            
            if (existing) {
                console.log(`⏩ Skipped: "${item.text}" (Already in cache)`);
                skipCount++;
                continue;
            }

            // 2. Generate Vector via Ollama
            process.stdout.write(`🧠 Embedding: "${item.text}"... `);
            const vector = await getTextVector(item.text);

            if (!vector || vector.length === 0) {
                console.log("❌ Failed (Is Ollama running with nomic-embed-text model?)");
                continue;
            }

            // 3. Save to SQLite
            // We explicitly inject "manualOverride: true" just in case someone modifies the
            // seed data to include conversational training items, so they bypass the strict filter.
            item.action.manualOverride = true; 

            await SemanticCache.create({
                text: item.text,
                vector: JSON.stringify(vector),
                action: JSON.stringify(item.action)
            });

            console.log("✅ Done.");
            successCount++;
        }

        console.log("==============================");
        console.log(`🎉 Seeding Complete!`);
        console.log(`   Added: ${successCount}`);
        console.log(`   Skipped: ${skipCount}`);
        console.log("==============================");

    } catch (err) {
        console.error("❌ Fatal Error during seeding:", err.message);
    } finally {
        // Close DB connection so Node process can exit gracefully
        await sequelize.close();
        process.exit(0);
    }
}

// Execute
seedDatabase();

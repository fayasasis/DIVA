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
    // 🌐 Browsers & Web
    { text: "open brave", action: { intent: "open_app", entities: { action: "open", target: "brave" } } },
    { text: "launch brave browser", action: { intent: "open_app", entities: { action: "open", target: "brave" } } },
    { text: "start brave", action: { intent: "open_app", entities: { action: "open", target: "brave" } } },
    { text: "open brave browser", action: { intent: "open_app", entities: { action: "open", target: "brave" } } },

    { text: "open chrome", action: { intent: "open_app", entities: { action: "open", target: "chrome" } } },
    { text: "launch chrome", action: { intent: "open_app", entities: { action: "open", target: "chrome" } } },
    { text: "open google chrome", action: { intent: "open_app", entities: { action: "open", target: "chrome" } } },
    { text: "start my browser", action: { intent: "open_app", entities: { action: "open", target: "chrome" } } },

    { text: "open edge", action: { intent: "open_app", entities: { action: "open", target: "edge" } } },
    { text: "launch microsoft edge", action: { intent: "open_app", entities: { action: "open", target: "edge" } } },
    { text: "start edge browser", action: { intent: "open_app", entities: { action: "open", target: "edge" } } },
    { text: "open internet explorer", action: { intent: "open_app", entities: { action: "open", target: "edge" } } },

    // 👨💻 Development & Terminals
    { text: "open antigravity", action: { intent: "open_app", entities: { action: "open", target: "antigravity" } } },
    { text: "launch antigravity", action: { intent: "open_app", entities: { action: "open", target: "antigravity" } } },
    { text: "start antigravity editor", action: { intent: "open_app", entities: { action: "open", target: "antigravity" } } },

    { text: "open cursor", action: { intent: "open_app", entities: { action: "open", target: "cursor" } } },
    { text: "launch cursor", action: { intent: "open_app", entities: { action: "open", target: "cursor" } } },
    { text: "start cursor ai", action: { intent: "open_app", entities: { action: "open", target: "cursor" } } },
    { text: "open cursor editor", action: { intent: "open_app", entities: { action: "open", target: "cursor" } } },

    { text: "open git", action: { intent: "open_app", entities: { action: "open", target: "git" } } },
    { text: "launch git bash", action: { intent: "open_app", entities: { action: "open", target: "git" } } },
    { text: "start git", action: { intent: "open_app", entities: { action: "open", target: "git" } } },
    { text: "open version control", action: { intent: "open_app", entities: { action: "open", target: "git" } } },

    { text: "open vs code", action: { intent: "open_app", entities: { action: "open", target: "vscode" } } },
    { text: "launch visual studio code", action: { intent: "open_app", entities: { action: "open", target: "vscode" } } },
    { text: "start code editor", action: { intent: "open_app", entities: { action: "open", target: "vscode" } } },
    { text: "open code", action: { intent: "open_app", entities: { action: "open", target: "vscode" } } },

    { text: "open terminal", action: { intent: "open_app", entities: { action: "open", target: "cmd" } } },
    { text: "launch command prompt", action: { intent: "open_app", entities: { action: "open", target: "cmd" } } },
    { text: "start cmd", action: { intent: "open_app", entities: { action: "open", target: "cmd" } } },
    { text: "open console", action: { intent: "open_app", entities: { action: "open", target: "cmd" } } },
    { text: "bring up the terminal", action: { intent: "open_app", entities: { action: "open", target: "cmd" } } },

    // 🛠️ Core Utilities & System
    { text: "open calculator", action: { intent: "open_app", entities: { action: "open", target: "calculator" } } },
    { text: "launch calc", action: { intent: "open_app", entities: { action: "open", target: "calculator" } } },
    { text: "bring up the calculator", action: { intent: "open_app", entities: { action: "open", target: "calculator" } } },
    { text: "start calculator", action: { intent: "open_app", entities: { action: "open", target: "calculator" } } },

    { text: "open file explorer", action: { intent: "open_app", entities: { action: "open", target: "explorer" } } },
    { text: "launch windows explorer", action: { intent: "open_app", entities: { action: "open", target: "explorer" } } },
    { text: "open my files", action: { intent: "open_app", entities: { action: "open", target: "explorer" } } },
    { text: "show my folders", action: { intent: "open_app", entities: { action: "open", target: "explorer" } } },

    { text: "open snipping tool", action: { intent: "open_app", entities: { action: "open", target: "snipping tool" } } },
    { text: "take a screenshot", action: { intent: "open_app", entities: { action: "open", target: "snipping tool" } } },
    { text: "launch snip", action: { intent: "open_app", entities: { action: "open", target: "snipping tool" } } },
    { text: "start screen snip", action: { intent: "open_app", entities: { action: "open", target: "snipping tool" } } },

    { text: "open notepad", action: { intent: "open_app", entities: { action: "open", target: "notepad" } } },
    { text: "launch text editor", action: { intent: "open_app", entities: { action: "open", target: "notepad" } } },
    { text: "start notepad", action: { intent: "open_app", entities: { action: "open", target: "notepad" } } },
    { text: "bring up a scratchpad", action: { intent: "open_app", entities: { action: "open", target: "notepad" } } },

    { text: "open clock", action: { intent: "open_app", entities: { action: "open", target: "clock" } } },
    { text: "show alarms", action: { intent: "open_app", entities: { action: "open", target: "clock" } } },
    { text: "launch the timer", action: { intent: "open_app", entities: { action: "open", target: "clock" } } },
    { text: "open alarms and clock", action: { intent: "open_app", entities: { action: "open", target: "clock" } } },

    { text: "open weather", action: { intent: "open_app", entities: { action: "open", target: "weather" } } },
    { text: "check the forecast", action: { intent: "open_app", entities: { action: "open", target: "weather" } } },
    { text: "launch weather app", action: { intent: "open_app", entities: { action: "open", target: "weather" } } },
    { text: "show the weather", action: { intent: "open_app", entities: { action: "open", target: "weather" } } },

    { text: "open microsoft store", action: { intent: "open_app", entities: { action: "open", target: "store" } } },
    { text: "launch app store", action: { intent: "open_app", entities: { action: "open", target: "store" } } },
    { text: "open the windows store", action: { intent: "open_app", entities: { action: "open", target: "store" } } },

    { text: "open camera", action: { intent: "open_app", entities: { action: "open", target: "camera" } } },
    { text: "turn on the webcam", action: { intent: "open_app", entities: { action: "open", target: "camera" } } },
    { text: "launch camera app", action: { intent: "open_app", entities: { action: "open", target: "camera" } } },

    // 🎵 Media & Creativity
    { text: "open spotify", action: { intent: "app_control", entities: { action: "open", target: "spotify" } } },
    { text: "play music", action: { intent: "app_control", entities: { action: "open", target: "spotify" } } },
    { text: "launch spotify", action: { intent: "app_control", entities: { action: "open", target: "spotify" } } },
    { text: "start my playlist", action: { intent: "app_control", entities: { action: "open", target: "spotify" } } },

    { text: "open vlc", action: { intent: "open_app", entities: { action: "open", target: "vlc" } } },
    { text: "launch vlc player", action: { intent: "open_app", entities: { action: "open", target: "vlc" } } },
    { text: "start video player", action: { intent: "open_app", entities: { action: "open", target: "vlc" } } },
    { text: "open vlc media player", action: { intent: "open_app", entities: { action: "open", target: "vlc" } } },

    { text: "open media player", action: { intent: "open_app", entities: { action: "open", target: "media player" } } },
    { text: "launch windows media player", action: { intent: "open_app", entities: { action: "open", target: "media player" } } },
    { text: "start media player", action: { intent: "open_app", entities: { action: "open", target: "media player" } } },

    { text: "open obs", action: { intent: "open_app", entities: { action: "open", target: "obs" } } },
    { text: "launch obs studio", action: { intent: "open_app", entities: { action: "open", target: "obs" } } },
    { text: "start screen recording", action: { intent: "open_app", entities: { action: "open", target: "obs" } } },
    { text: "open broadcasting software", action: { intent: "open_app", entities: { action: "open", target: "obs" } } },

    { text: "open paint", action: { intent: "open_app", entities: { action: "open", target: "paint" } } },
    { text: "launch ms paint", action: { intent: "open_app", entities: { action: "open", target: "paint" } } },
    { text: "start drawing app", action: { intent: "open_app", entities: { action: "open", target: "paint" } } },
    { text: "open microsoft paint", action: { intent: "open_app", entities: { action: "open", target: "paint" } } },

    { text: "open photos", action: { intent: "open_app", entities: { action: "open", target: "photos" } } },
    { text: "launch photo gallery", action: { intent: "open_app", entities: { action: "open", target: "photos" } } },
    { text: "view my pictures", action: { intent: "open_app", entities: { action: "open", target: "photos" } } },
    { text: "open image viewer", action: { intent: "open_app", entities: { action: "open", target: "photos" } } },

    // 💬 Communication & Chat
    { text: "open whatsapp", action: { intent: "open_app", entities: { action: "open", target: "whatsapp" } } },
    { text: "launch wa", action: { intent: "open_app", entities: { action: "open", target: "whatsapp" } } },
    { text: "start whatsapp desktop", action: { intent: "open_app", entities: { action: "open", target: "whatsapp" } } },
    { text: "check my whatsapp", action: { intent: "open_app", entities: { action: "open", target: "whatsapp" } } },

    { text: "open telegram desktop", action: { intent: "open_app", entities: { action: "open", target: "telegram" } } },
    { text: "open telegram", action: { intent: "open_app", entities: { action: "open", target: "telegram" } } },
    { text: "launch tg", action: { intent: "open_app", entities: { action: "open", target: "telegram" } } },
    { text: "start telegram app", action: { intent: "open_app", entities: { action: "open", target: "telegram" } } },

    { text: "open teams", action: { intent: "open_app", entities: { action: "open", target: "teams" } } },
    { text: "launch microsoft teams", action: { intent: "open_app", entities: { action: "open", target: "teams" } } },
    { text: "start a teams meeting", action: { intent: "open_app", entities: { action: "open", target: "teams" } } },
    { text: "open my chats", action: { intent: "open_app", entities: { action: "open", target: "teams" } } },

    { text: "open outlook", action: { intent: "open_app", entities: { action: "open", target: "outlook" } } },
    { text: "check my email", action: { intent: "open_app", entities: { action: "open", target: "outlook" } } },
    { text: "launch mail", action: { intent: "open_app", entities: { action: "open", target: "outlook" } } },
    { text: "start microsoft outlook", action: { intent: "open_app", entities: { action: "open", target: "outlook" } } },

    // 📝 Office & Productivity
    { text: "open excel", action: { intent: "open_app", entities: { action: "open", target: "excel" } } },
    { text: "launch spreadsheets", action: { intent: "open_app", entities: { action: "open", target: "excel" } } },
    { text: "start microsoft excel", action: { intent: "open_app", entities: { action: "open", target: "excel" } } },
    { text: "open a new spreadsheet", action: { intent: "open_app", entities: { action: "open", target: "excel" } } },

    { text: "open word", action: { intent: "open_app", entities: { action: "open", target: "word" } } },
    { text: "launch ms word", action: { intent: "open_app", entities: { action: "open", target: "word" } } },
    { text: "start word processor", action: { intent: "open_app", entities: { action: "open", target: "word" } } },
    { text: "open a new document", action: { intent: "open_app", entities: { action: "open", target: "word" } } },

    { text: "open powerpoint", action: { intent: "open_app", entities: { action: "open", target: "powerpoint" } } },
    { text: "launch ppt", action: { intent: "open_app", entities: { action: "open", target: "powerpoint" } } },
    { text: "start presentation", action: { intent: "open_app", entities: { action: "open", target: "powerpoint" } } },
    { text: "open microsoft powerpoint", action: { intent: "open_app", entities: { action: "open", target: "powerpoint" } } },

    { text: "open obsidian", action: { intent: "open_app", entities: { action: "open", target: "obsidian" } } },
    { text: "launch my notes", action: { intent: "open_app", entities: { action: "open", target: "obsidian" } } },
    { text: "start obsidian vault", action: { intent: "open_app", entities: { action: "open", target: "obsidian" } } },
    { text: "open note taking app", action: { intent: "open_app", entities: { action: "open", target: "obsidian" } } },

    { text: "open to do", action: { intent: "open_app", entities: { action: "open", target: "to do" } } },
    { text: "launch my tasks", action: { intent: "open_app", entities: { action: "open", target: "to do" } } },
    { text: "show my to do list", action: { intent: "open_app", entities: { action: "open", target: "to do" } } },
    { text: "open microsoft to do", action: { intent: "open_app", entities: { action: "open", target: "to do" } } },

    { text: "open calendar", action: { intent: "open_app", entities: { action: "open", target: "calendar" } } },
    { text: "show my schedule", action: { intent: "open_app", entities: { action: "open", target: "calendar" } } },
    { text: "launch my calendar", action: { intent: "open_app", entities: { action: "open", target: "calendar" } } },
    { text: "check my agenda", action: { intent: "open_app", entities: { action: "open", target: "calendar" } } },

    { text: "open onedrive", action: { intent: "open_app", entities: { action: "open", target: "onedrive" } } },
    { text: "launch cloud storage", action: { intent: "open_app", entities: { action: "open", target: "onedrive" } } },
    { text: "open my cloud drive", action: { intent: "open_app", entities: { action: "open", target: "onedrive" } } },

    // System Actions
    { text: "shutdown computer", action: { type: "system_action", entities: { command: "shutdown" } } },
    { text: "restart computer", action: { type: "system_action", entities: { command: "restart system" } } },
    { text: "lock computer", action: { type: "system_action", entities: { command: "lock" } } },
    { text: "sleep", action: { type: "system_action", entities: { command: "sleep" } } },
    { text: "volume up", action: { type: "system_action", entities: { command: "volume up" } } },
    { text: "volume down", action: { type: "system_action", entities: { command: "volume down" } } },
    { text: "mute volume", action: { type: "system_action", entities: { command: "mute" } } },
    { text: "open settings", action: { intent: "open_app", entities: { action: "open", target: "settings" } } },
    { text: "open task manager", action: { intent: "open_app", entities: { action: "open", target: "task manager" } } },
    { text: "minimize all windows", action: { intent: "window_control", entities: { action: "minimize_all" } } },
    { text: "show desktop", action: { intent: "window_control", entities: { action: "show_desktop" } } },
    { text: "pause music", action: { type: "web_search", intent: "media_control", entities: { action: "pause" } } },
    { text: "next track", action: { type: "web_search", intent: "media_control", entities: { action: "next" } } },
    { text: "previous track", action: { type: "web_search", intent: "media_control", entities: { action: "previous" } } },
    { text: "increase brightness", action: { type: "system_action", entities: { command: "brightness up" } } },
    { text: "decrease brightness", action: { type: "system_action", entities: { command: "brightness down" } } },
    { text: "empty recycle bin", action: { type: "system_action", entities: { command: "empty trash" } } },

    // File Actions
    { text: "open desktop", action: { intent: "file_action", entities: { action: "open", target: "Desktop" } } },
    { text: "open downloads folder", action: { intent: "file_action", entities: { action: "open", target: "Downloads" } } },
    { text: "open documents folder", action: { intent: "file_action", entities: { action: "open", target: "Documents" } } },
    { text: "open pictures folder", action: { intent: "file_action", entities: { action: "open", target: "Pictures" } } },

    // 👋 1. Greetings & Wake Words
    { text: "hello diva", action: { type: "conversation", response: "Hello Fayas. Systems are online and ready. What can I help you with?" } },
    { text: "hi there", action: { type: "conversation", response: "Hello Fayas. Systems are online and ready. What can I help you with?" } },
    { text: "hey diva", action: { type: "conversation", response: "Hello Fayas. Systems are online and ready. What can I help you with?" } },
    { text: "good morning", action: { type: "conversation", response: "Hello Fayas. Systems are online and ready. What can I help you with?" } },
    { text: "wake up", action: { type: "conversation", response: "Hello Fayas. Systems are online and ready. What can I help you with?" } },
    { text: "are you there", action: { type: "conversation", response: "Hello Fayas. Systems are online and ready. What can I help you with?" } },

    // 🤖 2. Identity & Capabilities
    { text: "who are you", action: { type: "conversation", response: "I am DIVA, your Desktop Intelligent Virtual Assistant. I can manage your applications, predict your workflows, and help you navigate your system efficiently." } },
    { text: "what is your name", action: { type: "conversation", response: "I am DIVA, your Desktop Intelligent Virtual Assistant. I can manage your applications, predict your workflows, and help you navigate your system efficiently." } },
    { text: "introduce yourself", action: { type: "conversation", response: "I am DIVA, your Desktop Intelligent Virtual Assistant. I can manage your applications, predict your workflows, and help you navigate your system efficiently." } },
    { text: "what can you do", action: { type: "conversation", response: "I am DIVA, your Desktop Intelligent Virtual Assistant. I can manage your applications, predict your workflows, and help you navigate your system efficiently." } },
    { text: "what are your features", action: { type: "conversation", response: "I am DIVA, your Desktop Intelligent Virtual Assistant. I can manage your applications, predict your workflows, and help you navigate your system efficiently." } },

    // 📊 3. Status & Health Check
    { text: "how are you", action: { type: "conversation", response: "All systems are operating at optimal parameters. The semantic cache is active, and background observers are running flawlessly." } },
    { text: "how are you doing today", action: { type: "conversation", response: "All systems are operating at optimal parameters. The semantic cache is active, and background observers are running flawlessly." } },
    { text: "system status", action: { type: "conversation", response: "All systems are operating at optimal parameters. The semantic cache is active, and background observers are running flawlessly." } },
    { text: "give me a status update", action: { type: "conversation", response: "All systems are operating at optimal parameters. The semantic cache is active, and background observers are running flawlessly." } },
    { text: "is everything working", action: { type: "conversation", response: "All systems are operating at optimal parameters. The semantic cache is active, and background observers are running flawlessly." } },

    // ⏱️ 4. Time & Date
    { text: "what time is it", action: { type: "conversation", response: "The current time is {TIME}." } },
    { text: "tell me the time", action: { type: "conversation", response: "The current time is {TIME}." } },
    { text: "what is today's date", action: { type: "conversation", response: "Today's date is {DATE}." } },
    { text: "what day is it today", action: { type: "conversation", response: "Today is {DAY}, {DATE}." } },
    { text: "do you have the time", action: { type: "conversation", response: "The current time is {TIME}." } },

    // 🌤️ 5. Weather
    { text: "what is the weather like", action: { type: "conversation", response: "Fetching the latest weather data for you now... {WEATHER}" } },
    { text: "is it raining outside", action: { type: "conversation", response: "Fetching the latest weather data for you now... {WEATHER}" } },
    { text: "tell me the forecast", action: { type: "conversation", response: "Fetching the latest weather data for you now... {WEATHER}" } },
    { text: "what's the temperature right now", action: { type: "conversation", response: "Fetching the latest weather data for you now... {WEATHER}" } },
    { text: "do I need an umbrella today", action: { type: "conversation", response: "Fetching the latest weather data for you now... {WEATHER}" } },

    // 🍿 6. Entertainment & Recommendations
    { text: "recommend a movie", action: { type: "conversation", response: "If you are in the mood for a psychological thriller, I highly recommend 'Monster' or 'Death Note'. If you want some action, you can't go wrong with 'Jujutsu Kaisen' or catching up on 'One Piece'." } },
    { text: "what should I watch", action: { type: "conversation", response: "If you are in the mood for a psychological thriller, I highly recommend 'Monster' or 'Death Note'. If you want some action, you can't go wrong with 'Jujutsu Kaisen' or catching up on 'One Piece'." } },
    { text: "suggest an anime", action: { type: "conversation", response: "If you are in the mood for a psychological thriller, I highly recommend 'Monster' or 'Death Note'. If you want some action, you can't go wrong with 'Jujutsu Kaisen' or catching up on 'One Piece'." } },
    { text: "do you have any show recommendations", action: { type: "conversation", response: "If you are in the mood for a psychological thriller, I highly recommend 'Monster' or 'Death Note'. If you want some action, you can't go wrong with 'Jujutsu Kaisen' or catching up on 'One Piece'." } },
    { text: "i'm bored what should i watch", action: { type: "conversation", response: "If you are in the mood for a psychological thriller, I highly recommend 'Monster' or 'Death Note'. If you want some action, you can't go wrong with 'Jujutsu Kaisen' or catching up on 'One Piece'." } },

    // 🦾 7. The "How do you work?"
    { text: "how do you work", action: { type: "conversation", response: "I use a combination of local LLM processing and semantic caching. If I recognize a command via vector similarity, I bypass the LLM entirely, allowing me to execute system actions in milliseconds." } },
    { text: "explain your architecture", action: { type: "conversation", response: "I use a combination of local LLM processing and semantic caching. If I recognize a command via vector similarity, I bypass the LLM entirely, allowing me to execute system actions in milliseconds." } },
    { text: "what is semantic caching", action: { type: "conversation", response: "I use a combination of local LLM processing and semantic caching. If I recognize a command via vector similarity, I bypass the LLM entirely, allowing me to execute system actions in milliseconds." } },
    { text: "how are you so fast", action: { type: "conversation", response: "I use a combination of local LLM processing and semantic caching. If I recognize a command via vector similarity, I bypass the LLM entirely, allowing me to execute system actions in milliseconds." } },
    { text: "tell me about your backend", action: { type: "conversation", response: "I use a combination of local LLM processing and semantic caching. If I recognize a command via vector similarity, I bypass the LLM entirely, allowing me to execute system actions in milliseconds." } },

    // 🙏 8. Gratitude & Farewells
    { text: "thank you", action: { type: "conversation", response: "You're welcome. Going into standby mode. Let me know if you need anything else." } },
    { text: "thanks diva", action: { type: "conversation", response: "You're welcome. Going into standby mode. Let me know if you need anything else." } },
    { text: "i appreciate it", action: { type: "conversation", response: "You're welcome. Going into standby mode. Let me know if you need anything else." } },
    { text: "goodbye", action: { type: "conversation", response: "You're welcome. Going into standby mode. Let me know if you need anything else." } },
    { text: "go to sleep", action: { type: "conversation", response: "You're welcome. Going into standby mode. Let me know if you need anything else." } },
    { text: "see you later", action: { type: "conversation", response: "You're welcome. Going into standby mode. Let me know if you need anything else." } }

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

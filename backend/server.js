// ==============================
// BACKEND API SERVER (Node.js + Express)
// ==============================
// This is the "Brain Hub" of the application.
// It orchestrates:
// 1. API Requests (from Frontend)
// 2. Database Operations (SQLite)
// 3. AI Processing (Ollama)
// 4. Real-time Communication (Socket.IO)
// 5. Automation Execution (PowerShell)

const express = require('express');      // Web Framework for handling HTTP requests
const cors = require('cors');            // CORS (Cross-Origin Resource Sharing) middleware
const http = require('http');            // Node.js native HTTP module
const { Server } = require('socket.io'); // Real-time WebSocket library
const path = require('path');            // File path utility module
const sequelize = require('./config/database'); // Import Database Config
const Chat = require('./models/Chat');          // Import Chat Model
const Session = require('./models/Session');    // Import Session Model
const SemanticCache = require('./models/SemanticCache'); // Import Semantic Cache Model
const Trash = require('./models/Trash');        // Import Trash Model

// --- LINKING SIBLING MODULES ---
// We import functions from other folders (AI, Automation) to unify logic here.
const { queryOllama, generateTitle } = require(path.join(__dirname, '../ai/ollamaService')); // AI Wrapper
const { executeAction } = require(path.join(__dirname, '../automation/index')); // Automation Dispatcher
const { startListening } = require(path.join(__dirname, '../ai/voiceService')); // Voice Input
const { getTextVector, cosineSimilarity } = require('./utils/embedding'); // Semantic Cache Math

// Initialize Express Application
const app = express();

// Create HTTP Server wrapping the Express app (required for Socket.IO)
const server = http.createServer(app);

// Define the Port number (5000 is standard for Flask/Node backends)
const PORT = 5000;

// --- IDLE WORKER STATE ---
let titleAbortController = null;
let lastActivityTime = Date.now();

// --- IN-MEMORY CONVERSATION BUFFER ---
// Stores the active 6-message rolling context per session for fast Ollama /api/chat processing
const activeChatHistory = {}; // Format: { "sessionId1": [ {role: "user", content: "..."}, {role: "assistant", ...} ] }

/**
 * Pushes a new message to the RAM buffer and enforces the 6-message limit.
 * @param {number|string} sessionId - The ID of the conversation
 * @param {string} role - 'user' or 'bot' (bot is auto-mapped to 'assistant' for Ollama)
 * @param {string|object} content - The text or JSON to store
 */
function updateChatHistory(sessionId, role, content) {
    if (!activeChatHistory[sessionId]) {
        activeChatHistory[sessionId] = [];
    }

    // Normalize DB roles to Ollama API roles
    const apiRole = role === 'bot' ? 'assistant' : 'user';
    const textContent = typeof content === 'string' ? content : JSON.stringify(content);

    activeChatHistory[sessionId].push({ role: apiRole, content: textContent });

    // Enforce rolling window (last 6 messages / 3 conversational turns)
    if (activeChatHistory[sessionId].length > 6) {
        activeChatHistory[sessionId] = activeChatHistory[sessionId].slice(-6);
    }
}

// MIDDLEWARE SETUP
app.use(cors());          // Allow requests from React Frontend (different port)
app.use(express.json());  // Enable parsing of JSON bodies in POST requests

// SOCKET.IO SETUP
// This enables real-time bidirectional events (e.g., Voice, Notifications)
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] } // Allow all origins for dev
});

// --- DATABASE RELATIONSHIPS ---
// Define how Tables relate to each other.
// A Session (Conversation) has many Chat messages.
// If a Session is deleted, all its Chats are deleted (CASCADE).
Session.hasMany(Chat, { foreignKey: 'sessionId', onDelete: 'CASCADE' });
Chat.belongsTo(Session, { foreignKey: 'sessionId' });

// --- DATABASE SYNCHRONIZATION ---
// This connects to SQLite and creates tables if they don't exist.
sequelize.sync().then(() => {
    console.log("SQLite Database Synced & Ready (Schema Updated).");
    runIdleTitleGenerator(); // Start the background worker after DB is ready
    runTrashPurger();        // Start the trash cleanup worker
});

// --- HELPER FUNCTION: SAVE MESSAGE ---
// Utility to save a chat message to the database asynchronously.
const saveMessage = async (sessionId, role, message) => {
    try {
        // If message is an object (like a JSON action), stringify it first
        const msgText = typeof message === 'string' ? message : JSON.stringify(message);
        await Chat.create({ sessionId, role, message: msgText });
    } catch (err) {
        console.error("DB SAVE ERROR:", err.message);
    }
};

// ==============================
// REST API ROUTES
// ==============================

// --- GET ALL SESSIONS ---
// Used by the Sidebar to list all conversation history.
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.findAll({
            order: [['updatedAt', 'DESC']] // Show newest first
        });
        res.json(sessions); // Return array to frontend
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

// --- GET MESSAGES FOR A SESSION ---
// Loads the chat history when a user clicks a session in the sidebar.
app.get('/sessions/:id', async (req, res) => {
    try {
        console.log(`Loading Session ID: ${req.params.id}`);
        const chats = await Chat.findAll({
            where: { sessionId: req.params.id }, // Filter by Session ID
            order: [['createdAt', 'ASC']]       // Show oldest to newest
        });
        console.log(`Found ${chats.length} messages for Session ${req.params.id}`);
        res.json(chats);
    } catch (err) {
        console.error("Load Error:", err);
        res.status(500).json({ error: "Failed to load chat" });
    }
});

// --- RENAME SESSION ---
// Allows user to edit the chat title.
app.put('/sessions/:id', async (req, res) => {
    try {
        await Session.update({ title: req.body.title }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to rename" });
    }
});

// --- DELETE SESSION ---
// Deletes a conversation and all its messages.
app.delete('/sessions/:id', async (req, res) => {
    try {
        console.log(`DELETE Request for Session: ${req.params.id}`);

        // Step 1: Delete all messages associated with this session (Child first)
        await Chat.destroy({ where: { sessionId: req.params.id } });

        // Step 2: Delete the session entry itself (Parent second)
        const deleted = await Session.destroy({ where: { id: req.params.id } });

        if (deleted) {
            console.log(`Successfully deleted Session ${req.params.id}`);
            res.json({ success: true });
        } else {
            console.warn(`Session ${req.params.id} not found in DB`);
            res.status(404).json({ error: "Session not found" });
        }
    } catch (err) {
        console.error("DELETE FAILED:", err);
        res.status(500).json({ error: "Failed to delete", details: err.message });
    }
});

// --- CLEAR ALL HISTORY (WITH UNDO) ---
// Backs up sessions and chats to Trash before wiping.
app.delete('/api/settings/clear-history', async (req, res) => {
    try {
        console.log("CRITICAL: Clear All History requested. Backing up to Trash...");
        
        // Step 1: Fetch all data for backup
        const sessions = await Session.findAll({ include: [Chat] });
        
        if (sessions.length > 0) {
            // Convert Sequelize instances to plain objects for safe serialization
            const backupData = sessions.map(s => s.get({ plain: true }));
            
            await Trash.create({
                type: 'HISTORY_WIPE',
                data: JSON.stringify(backupData)
            });
            console.log(`Backed up ${sessions.length} sessions to Trash.`);
        }
        
        // Step 2: Delete all Chats and Sessions in correct order
        // We delete Chats first to avoid Foreign Key Constraint errors
        await Chat.destroy({ where: {}, truncate: false });
        await Session.destroy({ where: {}, truncate: false });
        
        // Step 3: Clear RAM buffer
        Object.keys(activeChatHistory).forEach(key => delete activeChatHistory[key]);

        console.log("Database & RAM history moved to Trash.");
        res.json({ success: true, message: "Chat history moved to Trash. You have 24 hours to undo." });
    } catch (err) {
        console.error("CLEAR HISTORY FAILED:", err);
        res.status(500).json({ error: "Failed to clear history", details: err.message, stack: err.stack });
    }
});

// --- RESET AI MODEL & CACHE (WITH UNDO) ---
// Backs up semantic cache and activity logs to Trash before wiping.
app.delete('/api/settings/reset-model', async (req, res) => {
    try {
        console.log("CRITICAL: Reset AI Model requested. Backing up to Trash...");

        // Step 1: Fetch all data for backup
        const cache = await SemanticCache.findAll();
        const logs = await sequelize.query("SELECT * FROM activity_logs", { type: sequelize.QueryTypes.SELECT });

        if (cache.length > 0 || logs.length > 0) {
            await Trash.create({
                type: 'MODEL_RESET',
                data: JSON.stringify({ 
                    cache: cache.map(c => c.get({ plain: true })), 
                    logs 
                })
            });
        }

        // Step 2: Wipe Semantic Cache
        await SemanticCache.destroy({ where: {}, truncate: false });

        // Step 3: Wipe Activity Logs
        await sequelize.query("DELETE FROM activity_logs");

        console.log("AI Model & Activity logs moved to Trash.");
        res.json({ success: true, message: "AI model reset. Data moved to Trash for 24 hours." });
    } catch (err) {
        console.error("RESET MODEL FAILED:", err);
        res.status(500).json({ error: "Failed to reset model", details: err.message, stack: err.stack });
    }
});

// --- UNDO LAST DELETE ACTION ---
// Restores the most recent backup from the Trash if it's within the 24h window.
app.post('/api/settings/undo', async (req, res) => {
    try {
        const lastTrash = await Trash.findOne({ order: [['createdAt', 'DESC']] });
        if (!lastTrash) return res.status(404).json({ error: "Nothing to undo." });

        const data = JSON.parse(lastTrash.data);

        if (lastTrash.type === 'HISTORY_WIPE') {
            for (const sessionData of data) {
                const session = await Session.create({
                    id: sessionData.id,
                    title: sessionData.title,
                    isTitleGenerated: sessionData.isTitleGenerated,
                    createdAt: sessionData.createdAt,
                    updatedAt: sessionData.updatedAt
                });
                if (sessionData.Chats) {
                    for (const chatData of sessionData.Chats) {
                        await Chat.create({
                            id: chatData.id,
                            sessionId: session.id,
                            role: chatData.role,
                            message: chatData.message,
                            createdAt: chatData.createdAt,
                            updatedAt: chatData.updatedAt
                        });
                    }
                }
            }
        } else if (lastTrash.type === 'MODEL_RESET') {
            if (data.cache) {
                for (const item of data.cache) {
                    await SemanticCache.create(item);
                }
            }
            if (data.logs) {
                for (const log of data.logs) {
                    await sequelize.query(
                        "INSERT INTO activity_logs (id, timestamp, action_type, action_value, accepted) VALUES (?, ?, ?, ?, ?)",
                        { replacements: [log.id, log.timestamp, log.action_type, log.action_value, log.accepted] }
                    );
                }
            }
        }

        await lastTrash.destroy();
        res.json({ success: true, message: "Action successfully undone!" });
    } catch (err) {
        console.error("UNDO FAILED:", err);
        res.status(500).json({ error: "Failed to undo action", details: err.message });
    }
});

// --- EXECUTE PREDICTION (AI SUGGESTION) ---
// Called when user clicks "Accept" on a suggestion popup.
app.post('/api/execute-prediction', async (req, res) => {
    try {
        const { prediction } = req.body;
        console.log("Executing Prediction:", prediction);

        const target = prediction.next_action || prediction.target;
        if (!target) return res.status(400).json({ error: "No target" });

        // Normalize the prediction into an "Action Decision" format
        const decision = {
            intent: 'open_app',
            entities: { app: target }
        };

        // Execute the action (e.g., Open Calculator)
        const result = await executeAction(decision);
        res.json({ success: true, message: result });

    } catch (err) {
        console.error("Execution Failed:", err);
        res.status(500).json({ error: "Execution failed" });
    }
});

// --- MAIN CHAT COMPLETION ENDPOINT ---
// Handles user text input -> AI Processing -> Action Execution -> Response
app.post('/chat', async (req, res) => {
    lastActivityTime = Date.now();

    // Preempt any background title generation to reserve AI power for the user
    if (titleAbortController) {
        console.log("\n\x1b[31m[PREEMPT] Aborting background title generation for user priority!\x1b[0m");
        titleAbortController.abort();
        titleAbortController = null; // Clear gracefully
    }

    const { text, sessionId: reqSessionId, safeMode, bypassSafeMode } = req.body;
    let sessionId = reqSessionId;
    let isNewSession = false;
    let newTitle = "";

    console.log(`\nReceived: "${text}" [Session: ${sessionId || 'NEW'}]`);

    // STEP 1: HANDLE NEW SESSIONS
    // If no sessionId provided, create a new one instantly to avoid blocking.
    if (!sessionId) {
        isNewSession = true;

        // Fast fallback title: first 5 words of user input
        const words = text.split(" ").slice(0, 5).join(" ");
        newTitle = words + (text.split(" ").length > 5 ? "..." : "");

        // Save new session to DB instantly
        // Flag it as not yet AI summarized
        const session = await Session.create({ title: newTitle, isTitleGenerated: false });
        sessionId = session.id;
    }

    // STEP 2: LOAD CONTEXT (HISTORY)
    // We now use the blazing-fast in-memory RAM array for Ollama Chat API!
    const ramHistory = activeChatHistory[sessionId] || [];

    // STEP 3: SAVE USER MESSAGE
    await saveMessage(sessionId, 'user', text);               // Save to DB permanently
    updateChatHistory(sessionId, 'user', text);               // Save to active RAM for Ollama

    // --- SEMANTIC CACHE INTEGRATION ---
    const cachedItems = await SemanticCache.findAll();

    // STEP 3.1: Check EXACT MATCH first for zero-latency cache hit
    let exactMatch = cachedItems.find(item => item.text.toLowerCase().trim() === text.toLowerCase().trim());

    let bestMatch = null;
    let highestSimilarity = -1;
    let queryVector = null;

    if (exactMatch) {
        bestMatch = exactMatch;
        highestSimilarity = 1.0; 
        console.log(`\n\x1b[32m=== EXACT CACHE HIT (Bypassing Vector Math) ===\x1b[0m`);
    } else {
        // STEP 3.2: Generate Vector for User Input if no exact match
        queryVector = await getTextVector(text);

        // STEP 3.3: Calculate Semantic Similarity
        for (const item of cachedItems) {
            const itemVector = JSON.parse(item.vector);
            const similarity = cosineSimilarity(queryVector, itemVector);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = item;
            }
        }
    }

    let decision;
    let finalResponse = "";

    // Similarity Threshold (0.98 = 98% match)
    // We increased this from 0.92 to 0.98 to prevent false positive cache hits on conversational queries
    // that happen to share embeddings with cached system actions (like "Blue is my favourite color" vs "Set light to blue").
    if (bestMatch && highestSimilarity >= 0.98) {
        let cachedDecision = JSON.parse(bestMatch.action);

        // ONLY use cache for system/web/file actions, bypass it for conversational topics
        // But if the user MANUALLY inserted a conversation into the DB, we respect the override.
        if (cachedDecision.type !== 'conversation' || cachedDecision.manualOverride) {
            console.log(`\n\x1b[32m=== SEMANTIC CACHE HIT (${(highestSimilarity * 100).toFixed(1)}%) ===\x1b[0m`);
            console.log(`Matched Query: "${bestMatch.text}"`);
            decision = cachedDecision;
            console.log("Using Cached AI Decision:", JSON.stringify(decision));
        } else {
            console.log(`\n\x1b[33m=== SEMANTIC CACHE IGNORED (Conversational match prevented at ${(highestSimilarity * 100).toFixed(1)}%) ===\x1b[0m`);
            bestMatch = null;
        }
    }

    if (!bestMatch || highestSimilarity < 0.98) {
        console.log(`\n\x1b[33m=== SEMANTIC CACHE MISS (Best match: ${(highestSimilarity * 100).toFixed(1)}%) ===\x1b[0m`);

        // STEP 4: PROCESS WITH AI (Only if Cache Miss)
        // Pass the blazing-fast RAM history into the new /api/chat endpoint
        decision = await queryOllama(text, ramHistory);
        console.log("Processed AI Decision:", JSON.stringify(decision, null, 2));

        // Save successful commands to Cache for next time.
        // STRICTLY EXCLUDE conversations from polluting the semantic memory.
        const isAction = decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action' || decision.intent;
        if (decision.type !== 'conversation' && isAction) {
            try {
                if (queryVector) { // Only save if a vector was actually generated
                    await SemanticCache.create({
                        text: text,
                        vector: JSON.stringify(queryVector),
                        action: JSON.stringify(decision)
                    });
                    console.log("\x1b[36m[Saved command to Semantic Cache]\x1b[0m");
                }
            } catch (e) {
                // Ignore unique constraint errors if exact string is somehow already there
            }
        }
    }


    // STEP 5: EXECUTE SYSTEM ACTIONS (IF ANY)
    // If the AI decides this is a command (e.g., "Open Notepad"), execute it.
    if (decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action' || decision.intent) {
        
        // --- SAFE MODE INTERCEPTION ---
        const isSensitive = () => {
             const intent = (decision.intent || decision.type || "").toLowerCase();
             const action = (decision.entities?.action || decision.entities?.command || "").toLowerCase();
             const t = text.toLowerCase();
             const dangerousKeywords = ['shutdown', 'restart computer', 'reboot', 'turn off computer'];
             if (dangerousKeywords.some(kw => t.includes(kw))) return true;
             if (intent.includes('delete') || action.includes('delete') || t.includes('delete')) return true;
             return false;
        };

        if (safeMode && !bypassSafeMode && isSensitive()) {
             console.log("\x1b[33m[SAFE MODE] Intercepted sensitive command. Awaiting UI confirmation.\x1b[0m");
             return res.json({ requiresConfirmation: true });
        }

        finalResponse = await executeAction(decision, text);
    } else {
        // Otherwise, just reply with text
        finalResponse = decision.response || "I am thinking...";
    }

    // STEP 6: SAVE BOT RESPONSE
    await saveMessage(sessionId, 'bot', finalResponse);               // Save to DB permanently 
    updateChatHistory(sessionId, 'assistant', finalResponse); // Save AI context to Active RAM (Raw Text only)

    // STEP 7: UPDATE TIMESTAMP
    // Mark the session as updated so it moves to the top of the sidebar.
    await Session.update({ changed: 'true' }, { where: { id: sessionId } });

    // STEP 8: RETURN RESPONSE TO FRONTEND
    res.json({
        ...decision,
        response: finalResponse,
        sessionId,
        isNewSession,
        title: newTitle
    });
});

// ==============================
// REAL-TIME SOCKET EVENTS (Voice)
// ==============================

io.on('connection', (socket) => {
    console.log(`Client Connected: ${socket.id}`);

    // CLIENT LISTENS FOR VOICE START
    socket.on('start_listening', (config) => {
        const safeMode = config?.safeMode ?? true;
        console.log("Received Start Command");

        // Start the Python 'ears' service
        startListening(async (recognizedText) => {
            console.log(`Voice Command: ${recognizedText}`);

            // Send captured text back to UI instantly
            socket.emit('voice_input', recognizedText);

            // LOGIC SIMILAR TO /chat endpoint, but simplified for voice
            let sessionId = null;
            try {
                // Create a temporary session for this voice command
                const session = await Session.create({ title: `${recognizedText.slice(0, 20)}...` });
                sessionId = session.id;
            } catch (e) { console.error("Session Create Error", e); }

            if (sessionId) await saveMessage(sessionId, 'user', recognizedText);

            // Process with AI using Voice RAM history
            const ramHistory = activeChatHistory[sessionId] || [];
            updateChatHistory(sessionId, 'user', recognizedText);

            const decision = await queryOllama(recognizedText, ramHistory);
            let botResponse = "";

            // Execute Actions
            if (decision.type === 'system_action' || decision.type === 'web_search') {
                
                // Voice Safe Mode Check
                const t = recognizedText.toLowerCase();
                const intent = (decision.intent || decision.type || "").toLowerCase();
                const action = (decision.entities?.action || decision.entities?.command || "").toLowerCase();
                const isSensitive = ['shutdown', 'restart computer', 'reboot', 'turn off computer'].some(kw => t.includes(kw)) || intent.includes('delete') || action.includes('delete') || t.includes('delete');
                
                if (safeMode && isSensitive) {
                    botResponse = "Safe mode prevented a sensitive voice command. Please type it in the console to confirm.";
                } else {
                    botResponse = await executeAction(decision, recognizedText);
                }

            } else {
                botResponse = decision.response || "I am listening.";
            }

            if (sessionId) {
                await saveMessage(sessionId, 'bot', botResponse);
                updateChatHistory(sessionId, 'assistant', botResponse);
            }

            // Speak/Show Response
            socket.emit('bot_response', botResponse);
        });
    });

    // CLIENT STOPS LISTENING
    socket.on('stop_listening', () => {
        const { stopListening } = require(path.join(__dirname, '../ai/voiceService'));
        stopListening();
    });
});

// ==============================
// BACKGROUND IDLE WORKER
// ==============================
async function runIdleTitleGenerator() {
    try {
        // Only run if 5 seconds have passed since last /chat activity
        if (Date.now() - lastActivityTime > 5000) {
            // Find a session that needs a title
            const sessionToTitle = await Session.findOne({
                where: { isTitleGenerated: false },
                order: [['createdAt', 'ASC']]
            });

            if (sessionToTitle) {
                console.log(`\n\x1b[36m[IDLE WORKER] Summarizing Session ${sessionToTitle.id} in background...\x1b[0m`);

                // Get the first 3 chats of this session to summarize
                const chats = await Chat.findAll({
                    where: { sessionId: sessionToTitle.id },
                    order: [['createdAt', 'ASC']],
                    limit: 3
                });

                if (chats.length > 0) {
                    const chatText = chats.map(c => `${c.role}: ${c.message}`).join("\n");

                    titleAbortController = new AbortController();
                    const newTitle = await generateTitle(chatText, titleAbortController.signal);
                    titleAbortController = null; // Clear it after success

                    if (newTitle) {
                        await Session.update(
                            { title: newTitle, isTitleGenerated: true },
                            { where: { id: sessionToTitle.id } }
                        );
                        console.log(`\x1b[32m[IDLE WORKER] Success: Session ${sessionToTitle.id} retitled to "${newTitle}"\x1b[0m\n`);
                        // Emit an event so frontend dynamically updates
                        io.emit('session_updated');
                    }
                } else {
                    // No chats yet, mark as generated to skip future checks
                    await Session.update({ isTitleGenerated: true }, { where: { id: sessionToTitle.id } });
                }
            }
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("\x1b[31m[IDLE WORKER] Error:\x1b[0m", err.message);
        }
    }

    // Check again in 3 seconds
    setTimeout(runIdleTitleGenerator, 3000);
}

// --- BACKGROUND TRASH PURGER ---
// Automatically deletes backups older than a certain threshold.
async function runTrashPurger() {
    try {
        const { Op } = require('sequelize');
        
        // PRODUCTION SETTING: 24-hour undo window.
        const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000); 

        const deletedCount = await Trash.destroy({
            where: {
                createdAt: {
                    [Op.lt]: thresholdDate
                }
            }
        });

        if (deletedCount > 0) {
            console.log(`\x1b[35m[TRASH PURGER] Permanently deleted ${deletedCount} expired backups.\x1b[0m`);
        }
    } catch (err) {
        console.error("[TRASH PURGER] Error:", err.message);
    }

    // Check every hour
    setTimeout(runTrashPurger, 60 * 60 * 1000);
}

// START THE SERVER
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// ==============================
// BACKEND API SERVER (Node.js + Express)
// ==============================

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sequelize = require('./config/database');
const Chat = require('./models/Chat');
const Session = require('./models/Session');
const SemanticCache = require('./models/SemanticCache');
const Trash = require('./models/Trash');

const { queryOllama, generateTitle } = require(path.join(__dirname, '../ai/ollamaService'));
const { executeAction } = require(path.join(__dirname, '../automation/index'));
const { startListening } = require(path.join(__dirname, '../ai/voiceService'));
const { getTextVector, cosineSimilarity } = require('./utils/embedding');

const app = express();
const server = http.createServer(app);
const PORT = 5000;

let titleAbortController = null;
let lastActivityTime = Date.now();

const activeChatHistory = {};

function updateChatHistory(sessionId, role, content) {
    if (!activeChatHistory[sessionId]) activeChatHistory[sessionId] = [];
    const apiRole = role === 'bot' ? 'assistant' : 'user';
    const textContent = typeof content === 'string' ? content : JSON.stringify(content);
    activeChatHistory[sessionId].push({ role: apiRole, content: textContent });
    if (activeChatHistory[sessionId].length > 6) {
        activeChatHistory[sessionId] = activeChatHistory[sessionId].slice(-6);
    }
}

app.use(cors());
app.use(express.json());

const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

Session.hasMany(Chat, { foreignKey: 'sessionId', onDelete: 'CASCADE' });
Chat.belongsTo(Session, { foreignKey: 'sessionId' });

sequelize.sync().then(() => {
    console.log("SQLite Database Synced & Ready (Schema Updated).");
    runIdleTitleGenerator();
    runTrashPurger();
});

const saveMessage = async (sessionId, role, message) => {
    try {
        const msgText = typeof message === 'string' ? message : JSON.stringify(message);
        await Chat.create({ sessionId, role, message: msgText });
    } catch (err) {
        console.error("DB SAVE ERROR:", err.message);
    }
};

// ==============================
// REST API ROUTES
// ==============================

app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.findAll({ order: [['updatedAt', 'DESC']] });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

app.get('/sessions/:id', async (req, res) => {
    try {
        console.log(`Loading Session ID: ${req.params.id}`);
        const chats = await Chat.findAll({ where: { sessionId: req.params.id }, order: [['createdAt', 'ASC']] });
        console.log(`Found ${chats.length} messages for Session ${req.params.id}`);
        res.json(chats);
    } catch (err) {
        console.error("Load Error:", err);
        res.status(500).json({ error: "Failed to load chat" });
    }
});

app.put('/sessions/:id', async (req, res) => {
    try {
        await Session.update({ title: req.body.title }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to rename" });
    }
});

app.delete('/sessions/:id', async (req, res) => {
    try {
        console.log(`DELETE Request for Session: ${req.params.id}`);
        await Chat.destroy({ where: { sessionId: req.params.id } });
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

app.delete('/api/settings/clear-history', async (req, res) => {
    try {
        console.log("CRITICAL: Clear All History requested. Backing up to Trash...");
        const sessions = await Session.findAll({ include: [Chat] });
        if (sessions.length > 0) {
            const backupData = sessions.map(s => s.get({ plain: true }));
            await Trash.create({ type: 'HISTORY_WIPE', data: JSON.stringify(backupData) });
            console.log(`Backed up ${sessions.length} sessions to Trash.`);
        }
        await Chat.destroy({ where: {}, truncate: false });
        await Session.destroy({ where: {}, truncate: false });
        Object.keys(activeChatHistory).forEach(key => delete activeChatHistory[key]);
        console.log("Database & RAM history moved to Trash.");
        res.json({ success: true, message: "Chat history moved to Trash. You have 24 hours to undo." });
    } catch (err) {
        console.error("CLEAR HISTORY FAILED:", err);
        res.status(500).json({ error: "Failed to clear history", details: err.message, stack: err.stack });
    }
});

app.delete('/api/settings/reset-model', async (req, res) => {
    try {
        console.log("CRITICAL: Reset AI Model requested. Backing up to Trash...");
        const cache = await SemanticCache.findAll();
        const logs = await sequelize.query("SELECT * FROM activity_logs", { type: sequelize.QueryTypes.SELECT });
        if (cache.length > 0 || logs.length > 0) {
            await Trash.create({ type: 'MODEL_RESET', data: JSON.stringify({ cache: cache.map(c => c.get({ plain: true })), logs }) });
        }
        await SemanticCache.destroy({ where: {}, truncate: false });
        await sequelize.query("DELETE FROM activity_logs");
        console.log("AI Model & Activity logs moved to Trash.");
        res.json({ success: true, message: "AI model reset. Data moved to Trash for 24 hours." });
    } catch (err) {
        console.error("RESET MODEL FAILED:", err);
        res.status(500).json({ error: "Failed to reset model", details: err.message });
    }
});

app.post('/api/settings/undo', async (req, res) => {
    try {
        const lastTrash = await Trash.findOne({ order: [['createdAt', 'DESC']] });
        if (!lastTrash) return res.status(404).json({ error: "Nothing to undo." });
        const data = JSON.parse(lastTrash.data);
        if (lastTrash.type === 'HISTORY_WIPE') {
            for (const sessionData of data) {
                const session = await Session.create({
                    id: sessionData.id, title: sessionData.title,
                    isTitleGenerated: sessionData.isTitleGenerated,
                    createdAt: sessionData.createdAt, updatedAt: sessionData.updatedAt
                });
                if (sessionData.Chats) {
                    for (const chatData of sessionData.Chats) {
                        await Chat.create({
                            id: chatData.id, sessionId: session.id, role: chatData.role,
                            message: chatData.message, createdAt: chatData.createdAt, updatedAt: chatData.updatedAt
                        });
                    }
                }
            }
        } else if (lastTrash.type === 'MODEL_RESET') {
            if (data.cache) { for (const item of data.cache) { await SemanticCache.create(item); } }
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

app.post('/api/execute-prediction', async (req, res) => {
    try {
        const { prediction } = req.body;
        console.log("Executing Prediction:", prediction);
        const target = prediction.next_action || prediction.target;
        if (!target) return res.status(400).json({ error: "No target" });
        const decision = { intent: 'open_app', entities: { app: target } };
        const result = await executeAction(decision);
        res.json({ success: true, message: result });
    } catch (err) {
        console.error("Execution Failed:", err);
        res.status(500).json({ error: "Execution failed" });
    }
});

// --- MAIN CHAT COMPLETION ENDPOINT ---
app.post('/chat', async (req, res) => {
    lastActivityTime = Date.now();

    if (titleAbortController) {
        console.log("\n\x1b[31m[PREEMPT] Aborting background title generation for user priority!\x1b[0m");
        titleAbortController.abort();
        titleAbortController = null;
    }

    const { text, sessionId: reqSessionId, safeMode, bypassSafeMode } = req.body;
    let sessionId = reqSessionId;
    let isNewSession = false;
    let newTitle = "";

    console.log(`\nReceived: "${text}" [Session: ${sessionId || 'NEW'}]`);

    if (!sessionId) {
        isNewSession = true;
        const words = text.split(" ").slice(0, 5).join(" ");
        newTitle = words + (text.split(" ").length > 5 ? "..." : "");
        const session = await Session.create({ title: newTitle, isTitleGenerated: false });
        sessionId = session.id;
    }

    const ramHistory = activeChatHistory[sessionId] || [];

    await saveMessage(sessionId, 'user', text);
    updateChatHistory(sessionId, 'user', text);

    // --- SEMANTIC CACHE INTEGRATION ---
    const cachedItems = await SemanticCache.findAll();

    let exactMatch = cachedItems.find(item => item.text.toLowerCase().trim() === text.toLowerCase().trim());
    let bestMatch = null;
    let highestSimilarity = -1;
    let queryVector = null;

    if (exactMatch) {
        bestMatch = exactMatch;
        highestSimilarity = 1.0;
        console.log(`\n\x1b[32m=== EXACT CACHE HIT (Bypassing Vector Math) ===\x1b[0m`);
    } else {
        queryVector = await getTextVector(text);
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

    if (bestMatch && highestSimilarity >= 0.98) {
        let cachedDecision = JSON.parse(bestMatch.action);
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

        decision = await queryOllama(text, ramHistory);
        console.log("Processed AI Decision:", JSON.stringify(decision, null, 2));

        // --- LOCATION EXTRACTION FALLBACK ---
        // phi3 sometimes drops the location from delete/move/rename commands.
        const isFileAction = decision.type === 'file_action' || decision.intent === 'file_action';
        const needsLocation = ['delete', 'remove', 'move', 'rename', 'list'].includes((decision.entities?.action || '').toLowerCase());
        if (isFileAction && needsLocation && !decision.entities?.destination && !decision.entities?.path && !decision.entities?.location) {
            const fromMatch = text.match(/(?:from|in|inside|on)\s+(\w+)/i);
            if (fromMatch) {
                if (!decision.entities) decision.entities = {};
                decision.entities.location = fromMatch[1];
                console.log(`\x1b[36m[LOCATION FALLBACK] Extracted location: "${fromMatch[1]}" from raw query.\x1b[0m`);
            }
        }

        // --- RENAME FALLBACK ---
        // phi3 sometimes returns target as the new name instead of the old name.
        // If action is rename, extract "from X to Y" from raw query as fallback.
        if (isFileAction && (decision.entities?.action || '').toLowerCase() === 'rename') {
            if (!decision.entities?.new_name) {
                const renameMatch = text.match(/rename\s+(.+?)\s+(?:in\s+\w+\s+)?to\s+(.+)/i);
                if (renameMatch) {
                    decision.entities.target = renameMatch[1].trim();
                    decision.entities.new_name = renameMatch[2].trim();
                    console.log(`\x1b[36m[RENAME FALLBACK] target="${decision.entities.target}" new_name="${decision.entities.new_name}"\x1b[0m`);
                }
            }
        }

        // --- SAVE TO CACHE (exclude all file actions) ---
        const isAction = decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action' || decision.intent;
        if (decision.type !== 'conversation' && isAction && !isFileAction) {
            try {
                if (queryVector) {
                    await SemanticCache.create({
                        text: text,
                        vector: JSON.stringify(queryVector),
                        action: JSON.stringify(decision)
                    });
                    console.log("\x1b[36m[Saved command to Semantic Cache]\x1b[0m");
                }
            } catch (e) {}
        }
    }

    // STEP 5: EXECUTE SYSTEM ACTIONS
    if (decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action' || decision.intent) {

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
        finalResponse = decision.response || "I am thinking...";
    }

    await saveMessage(sessionId, 'bot', finalResponse);
    updateChatHistory(sessionId, 'assistant', finalResponse);
    await Session.update({ changed: 'true' }, { where: { id: sessionId } });

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

    socket.on('start_listening', (config) => {
        const safeMode = config?.safeMode ?? true;
        console.log("Received Start Command");

        startListening(async (recognizedText) => {
            console.log(`Voice Command: ${recognizedText}`);
            socket.emit('voice_input', recognizedText);

            let sessionId = null;
            try {
                const session = await Session.create({ title: `${recognizedText.slice(0, 20)}...` });
                sessionId = session.id;
            } catch (e) { console.error("Session Create Error", e); }

            if (sessionId) await saveMessage(sessionId, 'user', recognizedText);

            const ramHistory = activeChatHistory[sessionId] || [];
            updateChatHistory(sessionId, 'user', recognizedText);

            const decision = await queryOllama(recognizedText, ramHistory);
            let botResponse = "";

            if (decision.type === 'system_action' || decision.type === 'web_search' || decision.intent === 'file_action') {
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

            socket.emit('bot_response', botResponse);
        });
    });

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
        if (Date.now() - lastActivityTime > 5000) {
            const sessionToTitle = await Session.findOne({
                where: { isTitleGenerated: false },
                order: [['createdAt', 'ASC']]
            });

            if (sessionToTitle) {
                console.log(`\n\x1b[36m[IDLE WORKER] Summarizing Session ${sessionToTitle.id} in background...\x1b[0m`);
                const chats = await Chat.findAll({
                    where: { sessionId: sessionToTitle.id },
                    order: [['createdAt', 'ASC']],
                    limit: 3
                });

                if (chats.length > 0) {
                    const chatText = chats.map(c => `${c.role}: ${c.message}`).join("\n");
                    titleAbortController = new AbortController();
                    const newTitle = await generateTitle(chatText, titleAbortController.signal);
                    titleAbortController = null;

                    if (newTitle) {
                        await Session.update(
                            { title: newTitle, isTitleGenerated: true },
                            { where: { id: sessionToTitle.id } }
                        );
                        console.log(`\x1b[32m[IDLE WORKER] Success: Session ${sessionToTitle.id} retitled to "${newTitle}"\x1b[0m\n`);
                        io.emit('session_updated');
                    }
                } else {
                    await Session.update({ isTitleGenerated: true }, { where: { id: sessionToTitle.id } });
                }
            }
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("\x1b[31m[IDLE WORKER] Error:\x1b[0m", err.message);
        }
    }
    setTimeout(runIdleTitleGenerator, 3000);
}

async function runTrashPurger() {
    try {
        const { Op } = require('sequelize');
        const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deletedCount = await Trash.destroy({ where: { createdAt: { [Op.lt]: thresholdDate } } });
        if (deletedCount > 0) {
            console.log(`\x1b[35m[TRASH PURGER] Permanently deleted ${deletedCount} expired backups.\x1b[0m`);
        }
    } catch (err) {
        console.error("[TRASH PURGER] Error:", err.message);
    }
    setTimeout(runTrashPurger, 60 * 60 * 1000);
}

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
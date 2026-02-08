const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sequelize = require('./config/database');
const Chat = require('./models/Chat');
const Session = require('./models/Session');

// --- 🔗 LINKING SIBLING FOLDERS ---
// We use '../' to step out of 'backend' and into 'ai' or 'automation'
const { queryOllama } = require(path.join(__dirname, '../ai/ollamaService'));
const { executeAction } = require(path.join(__dirname, '../automation/actionHandler'));
const { startListening } = require(path.join(__dirname, '../ai/voiceService'));

const app = express();
const server = http.createServer(app);
const PORT = 5000;

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- ASSOCIATIONS ---
Session.hasMany(Chat, { foreignKey: 'sessionId', onDelete: 'CASCADE' });
Chat.belongsTo(Session, { foreignKey: 'sessionId' });

// --- INIT DATABASE ---
sequelize.sync().then(() => {
    console.log("📂 SQLite Database Synced & Ready (Schema Updated).");
});

// --- HELPER: SAVE MSG ---
const saveMessage = async (sessionId, role, message) => {
    try {
        const msgText = typeof message === 'string' ? message : JSON.stringify(message);
        await Chat.create({ sessionId, role, message: msgText });
    } catch (err) {
        console.error("❌ DB SAVE ERROR:", err.message);
    }
};

// --- API: SESSIONS (SIDEBAR) ---
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await Session.findAll({
            order: [['updatedAt', 'DESC']]
        });
        res.json(sessions);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch sessions" });
    }
});

// --- API: GET SPECIFIC SESSION MESSAGES ---
app.get('/sessions/:id', async (req, res) => {
    try {
        console.log(`📥 Loading Session ID: ${req.params.id}`);
        const chats = await Chat.findAll({
            where: { sessionId: req.params.id },
            order: [['createdAt', 'ASC']]
        });
        console.log(`✅ Found ${chats.length} messages for Session ${req.params.id}`);
        res.json(chats);
    } catch (err) {
        console.error("❌ Load Error:", err);
        res.status(500).json({ error: "Failed to load chat" });
    }
});

// --- API: RENAME SESSION ---
app.put('/sessions/:id', async (req, res) => {
    try {
        await Session.update({ title: req.body.title }, { where: { id: req.params.id } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to rename" });
    }
});

// --- API: DELETE SESSION ---
app.delete('/sessions/:id', async (req, res) => {
    try {
        console.log(`🗑️ DELETE Request for Session: ${req.params.id}`);

        // Manual Cascade: Delete messages first to avoid Foreign Key issues if DB strictness varies
        await Chat.destroy({ where: { sessionId: req.params.id } });

        // Then delete the session
        const deleted = await Session.destroy({ where: { id: req.params.id } });

        if (deleted) {
            console.log(`✅ Successfully deleted Session ${req.params.id}`);
            res.json({ success: true });
        } else {
            console.warn(`⚠️ Session ${req.params.id} not found in DB`);
            res.status(404).json({ error: "Session not found" });
        }
    } catch (err) {
        console.error("❌ DELETE FAILED:", err);
        res.status(500).json({ error: "Failed to delete", details: err.message });
    }
});

// --- ROUTE: CHAT ---
app.post('/chat', async (req, res) => {
    const { text, sessionId: reqSessionId } = req.body;
    let sessionId = reqSessionId;
    let isNewSession = false;
    let newTitle = "";

    console.log(`\n📩 Received: "${text}" [Session: ${sessionId || 'NEW'}]`);

    // 1. Create Session if Null
    if (!sessionId) {
        isNewSession = true;
        try {
            // Generate Title via AI (Strict JSON)
            const titleDecision = await queryOllama(`User query: "${text}". Create a short 3-5 word title for this chat session. Return ONLY JSON like this: { "type": "conversation", "response": "Your Title Here" }`);

            // Extract title from the response field
            newTitle = titleDecision.response.replace(/["']/g, "").trim();

            if (newTitle.length > 50) newTitle = newTitle.slice(0, 50); // Safety cap
        } catch (e) {
            newTitle = text.slice(0, 30) + "...";
        }

        const session = await Session.create({ title: newTitle });
        sessionId = session.id;
    }

    // 2. Fetch History BEFORE saving new message (to avoid duplication in context)
    const history = await Chat.findAll({
        where: { sessionId },
        order: [['createdAt', 'DESC']],
        limit: 10
    });
    const chronologicalHistory = history.reverse();

    // 3. Save User Message
    await saveMessage(sessionId, 'user', text);

    // 4. Process AI with History
    const decision = await queryOllama(text, chronologicalHistory);
    console.log("🤔 Processed AI Decision:", JSON.stringify(decision, null, 2));

    let finalResponse = "";
    // Allow 'file_action' or any response that has an explicit 'intent' to be executed
    if (decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action' || decision.intent) {
        finalResponse = await executeAction(decision, text);
    } else {
        finalResponse = decision.response || "I am thinking...";
    }

    // 4. Save Bot Message
    await saveMessage(sessionId, 'bot', finalResponse);

    // 5. Update Session Timestamp
    await Session.update({ changed: 'true' }, { where: { id: sessionId } }); // Triggers updatedAt

    res.json({
        ...decision,
        response: finalResponse,
        sessionId,
        isNewSession,
        title: newTitle
    });
});

// --- ROUTE: VOICE ---
io.on('connection', (socket) => {
    console.log(`⚡ Client Connected: ${socket.id}`);

    socket.on('start_listening', () => {
        console.log("🎤 Received Start Command");
        startListening(async (recognizedText) => {
            console.log(`🤖 Voice Command: ${recognizedText}`);
            socket.emit('voice_input', recognizedText);

            // 1. Create a Voice Session (for now, voice is atomic/new session per command usually)
            // Or better: try to reuse? For simplicity and to ensure saving, let's create one.
            let sessionId = null;
            try {
                const session = await Session.create({ title: `🎤 ${recognizedText.slice(0, 20)}...` });
                sessionId = session.id;
            } catch (e) { console.error("Session Create Error", e); }

            // 2. Save User Msg
            if (sessionId) await saveMessage(sessionId, 'user', recognizedText);

            const decision = await queryOllama(recognizedText);
            let botResponse = "";
            if (decision.type === 'system_action' || decision.type === 'web_search') {
                botResponse = await executeAction(decision, recognizedText);
            } else {
                botResponse = decision.response || "I am listening.";
            }

            // 3. Save Bot Msg
            if (sessionId) await saveMessage(sessionId, 'bot', botResponse);

            socket.emit('bot_response', botResponse);
        });
    });

    socket.on('stop_listening', () => {
        const { stopListening } = require(path.join(__dirname, '../ai/voiceService'));
        stopListening();
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
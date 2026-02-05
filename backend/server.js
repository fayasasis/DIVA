const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const sequelize = require('./config/database');
const Chat = require('./models/Chat');

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

// --- INIT DATABASE ---
sequelize.sync().then(() => {
    console.log("📂 SQLite Database Synced & Ready.");
});

// --- API: HISTORY ---
app.get('/history', async (req, res) => {
    try {
        const history = await Chat.findAll({
            order: [['createdAt', 'DESC']],
            limit: 50
        });
        res.json(history.reverse());
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});

// --- HELPER: SAVE MSG ---
const saveMessage = async (role, message) => {
    try {
        const msgText = typeof message === 'string' ? message : JSON.stringify(message);
        await Chat.create({ role, message: msgText });
    } catch (err) {
        console.error("❌ DB SAVE ERROR:", err.message);
    }
};

// --- ROUTE: CHAT ---
app.post('/chat', async (req, res) => {
    const userText = req.body.text; 
    console.log(`\n📩 Received: "${userText}"`);

    await saveMessage('user', userText);

    const decision = await queryOllama(userText);
    
    let finalResponse = "";
    if (decision.type === 'system_action') {
        finalResponse = await executeAction(decision);
    } else {
        finalResponse = decision.response || "I am thinking...";
    }

    await saveMessage('bot', finalResponse);
    res.json({ ...decision, response: finalResponse });
});

// --- ROUTE: VOICE ---
io.on('connection', (socket) => {
    console.log(`⚡ Client Connected: ${socket.id}`);

    socket.on('start_listening', () => {
        console.log("🎤 Received Start Command");
        startListening(async (recognizedText) => {
            console.log(`🤖 Voice Command: ${recognizedText}`);
            socket.emit('voice_input', recognizedText);
            await saveMessage('user', recognizedText);

            const decision = await queryOllama(recognizedText);
            let botResponse = "";
            if (decision.type === 'system_action') {
                botResponse = await executeAction(decision);
            } else {
                botResponse = decision.response || "I am listening.";
            }
            
            await saveMessage('bot', botResponse);
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
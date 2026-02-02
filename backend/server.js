const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// IMPORT THE DUMMY BRAIN
const { dummyLLM } = require('./src/llm/dummyLLM');

const app = express();
const server = http.createServer(app);
const PORT = 5000;

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.get('/', (req, res) => {
    res.send('✅ DIVA Backend is Running...');
});

// ==========================================
// 🧠 THE CHAT ENDPOINT (Frontend talks to this)
// ==========================================
app.post('/chat', (req, res) => {
    const userText = req.body.text; // Get text from frontend
    console.log(`📩 Received: "${userText}"`);

    // 1. Process with Dummy AI
    const decision = dummyLLM(userText);
    
    // 2. Log the decision
    console.log("🧠 AI Decision:", decision);

    // 3. Send back to Frontend
    res.json(decision);
});

io.on('connection', (socket) => {
    console.log(`⚡ New Client Connected: ${socket.id}`);
    socket.on('disconnect', () => { console.log('❌ Client Disconnected'); });
});

server.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`🚀 DIVA Backend (Dummy Mode) Active on Port ${PORT}`);
    console.log(`================================\n`);
});
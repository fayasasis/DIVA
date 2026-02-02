const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// ==========================================
// 🔗 CONNECTING EXTERNAL FOLDERS
// ==========================================
// We use path.join to jump out of 'backend' (..) and into 'ai' or 'automation'

// 1. Connect to the Brain (AI)
const { dummyLLM } = require(path.join(__dirname, '../ai/dummyLLM'));

// 2. Connect to the Muscles (Automation)
const { executeAction } = require(path.join(__dirname, '../automation/actionHandler'));


// ==========================================
// ⚙️ SERVER SETUP
// ==========================================
const app = express();
const server = http.createServer(app);
const PORT = 5000;

// Middleware (Security & Parsing)
app.use(cors());
app.use(express.json());

// Socket.io Setup (For real-time voice later)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});


// ==========================================
// 🛣️ API ROUTES
// ==========================================

// Health Check
app.get('/', (req, res) => {
    res.send('✅ DIVA Backend is Running & Connected to AI/Automation folders.');
});

// 🧠 MAIN CHAT ENDPOINT
app.post('/chat', (req, res) => {
    const userText = req.body.text; 
    console.log(`\n📩 Received: "${userText}"`);

    // 1. Ask the Brain (AI Folder)
    const decision = dummyLLM(userText);
    
    // 2. Check if Action is needed (Automation Folder)
    (async () => {
        let finalResponse = "";

        if (decision.type === 'system_action') {
            // Execute the muscle movement
            finalResponse = await executeAction(decision);
        } else {
            // Just a conversation
            finalResponse = decision.response;
        }

        // 3. Prepare response
        decision.response = finalResponse;
        
        console.log("📤 Sending back:", decision);
        res.json(decision);
    })();
});


// ==========================================
// 🔌 SOCKET.IO (Voice Stream Placeholder)
// ==========================================
io.on('connection', (socket) => {
    console.log(`⚡ Client Connected: ${socket.id}`);

    socket.on('disconnect', () => {
        console.log(`❌ Client Disconnected: ${socket.id}`);
    });
});


// ==========================================
// 🚀 START SERVER
// ==========================================
server.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`🚀 DIVA Backend Active on Port ${PORT}`);
    console.log(`🔗 Linked to: /ai and /automation`);
    console.log(`================================\n`);
});
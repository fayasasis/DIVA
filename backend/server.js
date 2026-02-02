const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// --- IMPORTS ---
// 1. Connect to Brain (Ollama)
const { queryOllama } = require(path.join(__dirname, '../ai/ollamaService'));

// 2. Connect to Muscles (Automation)
const { executeAction } = require(path.join(__dirname, '../automation/actionHandler'));

// 3. Connect to Ears (Voice)
const { startListening } = require(path.join(__dirname, '../ai/voiceService'));

const app = express();
const server = http.createServer(app);
const PORT = 5000;

app.use(cors());
app.use(express.json());

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// --- ROUTE 1: TEXT CHAT ---
app.post('/chat', async (req, res) => {
    const userText = req.body.text; 
    console.log(`\n📩 Received: "${userText}"`);

    // 1. Ask Phi-3
    const decision = await queryOllama(userText);
    
    // 2. Execute Decision
    let finalResponse = "";
    if (decision.type === 'system_action') {
        finalResponse = await executeAction(decision);
    } else {
        finalResponse = decision.response;
    }

    // 3. Send back
    decision.response = finalResponse;
    res.json(decision);
});

// --- ROUTE 2: VOICE CONTROL ---
io.on('connection', (socket) => {
    console.log(`⚡ Client Connected: ${socket.id}`);

    socket.on('start_listening', () => {
        console.log("🎤 Received Start Command");
        
        startListening(async (recognizedText) => {
            console.log(`🤖 Voice Command: ${recognizedText}`);
            socket.emit('voice_input', recognizedText);

            // 1. Ask Phi-3 (Async)
            const decision = await queryOllama(recognizedText);

            // 2. Execute
            let botResponse = "";
            if (decision.type === 'system_action') {
                botResponse = await executeAction(decision);
            } else {
                botResponse = decision.response;
            }
            
            socket.emit('bot_response', botResponse);
        });
    });

    socket.on('stop_listening', () => {
        console.log("🛑 Stop Command");
        const { stopListening } = require(path.join(__dirname, '../ai/voiceService'));
        stopListening();
    });
});

server.listen(PORT, () => {
    console.log(`🚀 DIVA Backend Active on Port ${PORT}`);
    console.log(`🧠 AI Model: Phi-3 Mini (via Ollama)`);
});
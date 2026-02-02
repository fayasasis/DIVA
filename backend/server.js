const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// IMPORT BRAIN AND MUSCLES
const { dummyLLM } = require('./src/llm/dummyLLM');
const { executeAction } = require('./src/intent/actionHandler'); // <--- NEW

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
// 🧠 THE CHAT ENDPOINT
// ==========================================
app.post('/chat', (req, res) => {
    const userText = req.body.text; 
    console.log(`📩 Received: "${userText}"`);

    // 1. Process with AI (Brain)
    const decision = dummyLLM(userText);
    
    // 2. Execute Action (Muscles) if needed
    (async () => {
        let finalResponse = "";

        if (decision.type === 'system_action') {
            // DO THE ACTION
            finalResponse = await executeAction(decision);
        } else {
            // JUST CHAT
            finalResponse = decision.response;
        }

        // 3. Send response back to Frontend
        // We modify the decision object to include the final confirmation text
        decision.response = finalResponse;
        
        console.log("📤 Sending back:", decision);
        res.json(decision);
    })();
});

server.listen(PORT, () => {
    console.log(`\n================================`);
    console.log(`🚀 DIVA Backend Active on Port ${PORT}`);
    console.log(`================================\n`);
});
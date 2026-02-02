// Import Express – used to create the backend server and APIs
const express = require('express');

// Import CORS – allows frontend (localhost:5173) to talk to backend (localhost:5000)
const cors = require('cors');

// Import HTTP – needed to attach socket.io later
const http = require('http');

// Import Socket.IO server – for future real-time voice streaming
const { Server } = require('socket.io');

// Import Path – used to safely access folders outside this directory
const path = require('path');


// ==========================================
// 🔗 CONNECTING EXTERNAL FOLDERS
// ==========================================
// backend/ does NOT contain AI or Automation logic directly
// We jump OUT of backend (..) and connect to those modules

// 1️⃣ Connect to the Brain (AI Layer)
const { dummyLLM } = require(
  path.join(__dirname, '../ai/dummyLLM')
);

// 2️⃣ Connect to the Muscles (Automation Layer)
const { executeAction } = require(
  path.join(__dirname, '../automation/actionHandler')
);


// ==========================================
// ⚙️ SERVER SETUP
// ==========================================

// Create Express app
const app = express();

// Wrap Express with HTTP server (required for socket.io)
const server = http.createServer(app);

// Backend will run on this port
const PORT = 5000;


// ==========================================
// 🛡️ MIDDLEWARE
// ==========================================

// Enable cross-origin requests (frontend ↔ backend)
app.use(cors());

// Automatically parse incoming JSON data
app.use(express.json());


// ==========================================
// 🔌 SOCKET.IO SETUP (FOR VOICE – FUTURE)
// ==========================================

// Create Socket.IO instance
const io = new Server(server, {
  cors: {
    origin: "*",       // Allow any frontend (for now)
    methods: ["GET", "POST"]
  }
});


// ==========================================
// 🛣️ API ROUTES
// ==========================================

// 🧪 Health Check Route
// Used to verify backend is alive
app.get('/', (req, res) => {
  res.send('✅ DIVA Backend is Running & Connected to AI/Automation folders.');
});


// ==========================================
// 🧠 MAIN CHAT ENDPOINT
// ==========================================

// This is the MAIN pipeline entry point
// Frontend sends user text here
app.post('/chat', (req, res) => {

  // Extract text sent by frontend
  const userText = req.body.text;

  console.log(`\n📩 Received: "${userText}"`);

  // 1️⃣ Ask the Brain (AI decides intent + type)
  const decision = dummyLLM(userText);

  // 2️⃣ Decide whether to execute an action or just respond
  (async () => {

    let finalResponse = "";

    if (decision.type === 'system_action') {

      // Execute OS-level command (Automation Layer)
      finalResponse = await executeAction(decision);

    } else {

      // Pure conversation – no system action
      finalResponse = decision.response;
    }

    // 3️⃣ Attach final response to decision object
    decision.response = finalResponse;

    console.log("📤 Sending back:", decision);

    // 4️⃣ Send structured response back to frontend
    res.json(decision);

  })();
});


// ==========================================
// 🔊 SOCKET.IO EVENTS (VOICE PLACEHOLDER)
// ==========================================

// Triggered when frontend connects via WebSocket
io.on('connection', (socket) => {

  console.log(`⚡ Client Connected: ${socket.id}`);

  // Triggered when client disconnects
  socket.on('disconnect', () => {
    console.log(`❌ Client Disconnected: ${socket.id}`);
  });
});


// ==========================================
// 🚀 START BACKEND SERVER
// ==========================================

// Start listening for frontend requests
server.listen(PORT, () => {

  console.log(`\n================================`);
  console.log(`🚀 DIVA Backend Active on Port ${PORT}`);
  console.log(`🔗 Linked to: /ai and /automation`);
  console.log(`================================\n`);

});

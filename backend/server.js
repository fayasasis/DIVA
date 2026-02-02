// ==============================
// CORE SERVER LIBRARIES
// ==============================

// Express is the backend framework
// It helps us create APIs like /chat
const express = require('express');

// CORS allows frontend (React) to talk to backend safely
const cors = require('cors');

// HTTP is used to create a server that Express + Socket.io can share
const http = require('http');

// Socket.io enables real-time communication (for voice streaming)
const { Server } = require('socket.io');

// Path helps us safely connect files across folders
const path = require('path');


// ==============================
// CONNECTING DIVA MODULES
// ==============================

// 🧠 1. BRAIN – AI DECISION MAKER
// This sends text to Phi-3 Mini (via Ollama)
// It returns a JSON decision like:
// { type, intent, entities, response }
const { queryOllama } = require(
  path.join(__dirname, '../ai/ollamaService')
);

// 🦾 2. MUSCLES – SYSTEM AUTOMATION
// Executes actions like opening apps
const { executeAction } = require(
  path.join(__dirname, '../automation/actionHandler')
);

// 👂 3. EARS – VOICE RECOGNITION
// Listens to microphone and converts speech → text
const { startListening } = require(
  path.join(__dirname, '../ai/voiceService')
);


// ==============================
// SERVER INITIALIZATION
// ==============================

const app = express();

// Create HTTP server so Express + Socket.io work together
const server = http.createServer(app);

// Backend runs on port 5000
const PORT = 5000;


// ==============================
// MIDDLEWARE (PRE-PROCESSING)
// ==============================

// Allow requests from frontend (React)
app.use(cors());

// Automatically parse JSON bodies
app.use(express.json());


// ==============================
// SOCKET.IO SETUP (REAL-TIME)
// ==============================

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});


// ==============================
// ROUTE 1: TEXT CHAT API
// ==============================
// This is used when user types text in frontend

app.post('/chat', async (req, res) => {

  // Extract user text from request body
  const userText = req.body.text;
  console.log(`\n📩 Received: "${userText}"`);

  // 1️⃣ Send text to AI Brain (Phi-3 Mini)
  const decision = await queryOllama(userText);

  // decision example:
  // {
  //   type: "system_action",
  //   intent: "open_app",
  //   entities: { app: "chrome" }
  // }

  // 2️⃣ Decide what to do
  let finalResponse = "";

  if (decision.type === 'system_action') {
    // If AI wants a system action → execute it
    finalResponse = await executeAction(decision);
  } else {
    // Otherwise just reply as conversation
    finalResponse = decision.response;
  }

  // 3️⃣ Send response back to frontend
  decision.response = finalResponse;
  res.json(decision);
});


// ==============================
// ROUTE 2: VOICE CONTROL (SOCKET)
// ==============================
// This handles microphone-based commands

io.on('connection', (socket) => {
  console.log(`⚡ Client Connected: ${socket.id}`);

  // ▶️ Frontend says: "Start Listening"
  socket.on('start_listening', () => {
    console.log("🎤 Received Start Command");

    // Start microphone listener
    startListening(async (recognizedText) => {

      console.log(`🤖 Voice Command: ${recognizedText}`);

      // Send recognized speech to frontend UI
      socket.emit('voice_input', recognizedText);

      // 1️⃣ Send speech text to AI
      const decision = await queryOllama(recognizedText);

      // 2️⃣ Execute or reply
      let botResponse = "";

      if (decision.type === 'system_action') {
        botResponse = await executeAction(decision);
      } else {
        botResponse = decision.response;
      }

      // 3️⃣ Send AI response back to frontend
      socket.emit('bot_response', botResponse);
    });
  });

  // ⏹️ Frontend says: "Stop Listening"
  socket.on('stop_listening', () => {
    console.log("🛑 Stop Command");

    // Dynamically import stop function
    const { stopListening } = require(
      path.join(__dirname, '../ai/voiceService')
    );

    stopListening();
  });
});


// ==============================
// START SERVER
// ==============================

server.listen(PORT, () => {
  console.log(`🚀 DIVA Backend Active on Port ${PORT}`);
  console.log(`🧠 AI Model: Phi-3 Mini (via Ollama)`);
});

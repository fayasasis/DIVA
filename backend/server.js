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

        // Step 1: Delete all messages associated with this session
        await Chat.destroy({ where: { sessionId: req.params.id } });

        // Step 2: Delete the session entry itself
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

    const { text, sessionId: reqSessionId } = req.body;
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
    // Fetch last 10 messages to give AI memory context.
    // We reverse them so they are in chronological order for the LLM.
    const history = await Chat.findAll({
        where: { sessionId },
        order: [['createdAt', 'DESC']],
        limit: 10
    });
    const chronologicalHistory = history.reverse();

    // STEP 3: SAVE USER MESSAGE
    await saveMessage(sessionId, 'user', text);

    // --- SEMANTIC CACHE INTEGRATION ---
    // STEP 3.1: Generate Vector for User Input
    const queryVector = await getTextVector(text);

    // STEP 3.2: Check Semantic Cache
    const cachedItems = await SemanticCache.findAll();
    let bestMatch = null;
    let highestSimilarity = -1;

    for (const item of cachedItems) {
        const itemVector = JSON.parse(item.vector);
        const similarity = cosineSimilarity(queryVector, itemVector);
        if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            bestMatch = item;
        }
    }

    let decision;
    let finalResponse = "";

    // Similarity Threshold (0.92 = 92% match)
    if (bestMatch && highestSimilarity > 0.92) {
        console.log(`\n\x1b[32m=== SEMANTIC CACHE HIT (${(highestSimilarity * 100).toFixed(1)}%) ===\x1b[0m`);
        console.log(`Matched Query: "${bestMatch.text}"`);
        decision = JSON.parse(bestMatch.action);
        console.log("Using Cached AI Decision:", JSON.stringify(decision));
    } else {
        console.log(`\n\x1b[33m=== SEMANTIC CACHE MISS (Best match: ${(highestSimilarity * 100).toFixed(1)}%) ===\x1b[0m`);

        // STEP 4: PROCESS WITH AI (Only if Cache Miss)
        decision = await queryOllama(text, chronologicalHistory);
        console.log("Processed AI Decision:", JSON.stringify(decision, null, 2));

        // Save successful commands to Cache for next time
        if (decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action') {
            try {
                await SemanticCache.create({
                    text: text,
                    vector: JSON.stringify(queryVector),
                    action: JSON.stringify(decision)
                });
                console.log("\x1b[36m[Saved command to Semantic Cache]\x1b[0m");
            } catch (e) {
                // Ignore unique constraint errors if exact string is somehow already there
            }
        }
    }


    // STEP 5: EXECUTE SYSTEM ACTIONS (IF ANY)
    // If the AI decides this is a command (e.g., "Open Notepad"), execute it.
    if (decision.type === 'system_action' || decision.type === 'web_search' || decision.type === 'file_action' || decision.intent) {
        finalResponse = await executeAction(decision, text);
    } else {
        // Otherwise, just reply with text
        finalResponse = decision.response || "I am thinking...";
    }

    // STEP 6: SAVE BOT RESPONSE
    await saveMessage(sessionId, 'bot', finalResponse);

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
    socket.on('start_listening', () => {
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

            // Process with AI
            const decision = await queryOllama(recognizedText);
            let botResponse = "";

            // Execute Actions
            if (decision.type === 'system_action' || decision.type === 'web_search') {
                botResponse = await executeAction(decision, recognizedText);
            } else {
                botResponse = decision.response || "I am listening.";
            }

            if (sessionId) await saveMessage(sessionId, 'bot', botResponse);

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

// START THE SERVER
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
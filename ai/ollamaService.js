// ==============================
// DIVA AI BRAIN CONNECTOR
// ==============================
// This file is responsible for talking to the AI model (Phi-3 Mini)
// It does NOT execute anything.
// It ONLY:
//   1. Sends user text to AI
//   2. Gets a structured decision (JSON)
//   3. Returns that decision to the backend
// ==============================


// ------------------------------
// AI MODEL CONFIGURATION
// ------------------------------

// This is the name of the model Ollama is running locally.
// "phi3" = Phi-3 Mini (small, fast, local LLM)
const MODEL_NAME = "phi3";


// ------------------------------
// MAIN FUNCTION: queryOllama
// ------------------------------
// Input: userText (string) → what the user typed or spoke
// Output: JSON decision object
//
// Example output:
// {
//   type: "system_action",
//   intent: "open_app",
//   entities: { app: "chrome" }
// }

async function queryOllama(userText) {

    // Debug log: helps us see when AI is being called
    console.log(`🧠 AI Thinking (${MODEL_NAME})...`);


    // ==============================
    // SYSTEM PROMPT (VERY IMPORTANT)
    // ==============================
    // This is the "instruction manual" we give to the AI.
    //
    // Without this, the AI might talk casually or give long answers.
    // With this, we FORCE it to behave like a classifier.
    //
    // The AI is told:
    // - What DIVA is
    // - What types of outputs are allowed
    // - To respond ONLY in JSON

    const systemPrompt = `
        You are DIVA, an Advanced Desktop Assistant.
        
        INSTRUCTIONS:
        Analyze the user's request and return strictly ONE of these JSON formats:

        1. [Open App] ("Open Notepad", "Start Chrome"):
           { "type": "system_action", "intent": "open_app", "entities": { "app": "notepad" } }
        
        2. [System Control] ("Volume up", "Mute", "Lock screen"):
           { "type": "system_action", "intent": "system_control", "entities": { "app": "volume up" } }
           (Use keywords: "volume up", "volume down", "mute", "lock")

        3. [Web Search] ("Google weather", "Search for cats"):
           { "type": "system_action", "intent": "web_search", "entities": { "query": "weather in Tokyo" } }

        4. [Conversation] ("Hello", "Tell me a joke"):
           { "type": "conversation", "response": "Your friendly reply here." }

        IMPORTANT:
        - Output PURE JSON only.
        - No explanations.
        - No markdown.

        User Input: "${userText}"
    `;


    // ==============================
    // CALLING OLLAMA (LOCAL AI)
    // ==============================
    // Ollama runs a local HTTP server on port 11434
    // We send a POST request with:
    //   - model name
    //   - prompt
    //   - JSON-only output requirement

    try {
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL_NAME,   // Which AI model to use
                prompt: systemPrompt, // Instructions + user input
                stream: false,        // We want full response, not chunks
                format: "json"        // FORCE JSON MODE
            })
        });

        // Convert HTTP response → JavaScript object
        const data = await response.json();

        // Ollama puts the model output inside `response`
        const rawText = data.response;

        console.log("🧠 Raw AI Reply:", rawText);


        // ==============================
        // JSON PARSING SAFETY
        // ==============================
        // Sometimes AI may still include extra text.
        // We try to parse JSON safely.

        try {
            return JSON.parse(rawText);
        } catch (e) {
            // If parsing fails, fallback to conversation
            console.error("❌ JSON Parse Failed. Raw:", rawText);

            return {
                type: "conversation",
                response: rawText
            };
        }

    } catch (error) {

        // This usually happens when Ollama is not running
        console.error("❌ Ollama Offline?", error);

        return {
            type: "conversation",
            response: "My brain is offline. Is Ollama running?"
        };
    }
}


// ------------------------------
// EXPORT FUNCTION
// ------------------------------
// Makes this function usable inside server.js
module.exports = { queryOllama };

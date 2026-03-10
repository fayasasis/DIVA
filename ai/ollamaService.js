const MODEL_NAME = "phi3"; // Define the AI model to be used (Phi-3 Mini).

/**
 * Main function to query the local Ollama AI instance using the chat API.
 * @param {string} userText - The input text or command from the user.
 * @param {Array} chatHistory - The array of historical {role, content} objects.
 * @returns {Promise<object>} - The structured JSON response from the AI.
 */
async function queryOllama(userText, chatHistory = []) {
    console.log(`AI Thinking (${MODEL_NAME})...`); // Log that AI processing has started.

    // Construct the System Prompt.
    // This tells the AI exactly how to behave and format its output.
    const systemPrompt = `
        You are DIVA, an advanced Desktop Assistant.
        Analyze the user's input and return strictly ONE JSON object.

        CATEGORIES:

        1. [App & Window Control] ("Open Notepad", "Close Chrome", "Minimize this", "Restart Spotify")
           { "type": "system_action", "intent": "app_control", "entities": { "action": "open", "target": "notepad" } }
           (actions: open, close, restart, minimize, maximize, switch_focus, show_desktop)

        2. [System & Files] ("Volume up", "Lock screen", "Create folder X", "Delete file Y")
           { "type": "system_action", "intent": "system_control", "entities": { "command": "volume_up" } }

        3. [Web Search] ("Search Google for AI", "Open YouTube", "Recent Oscar winners", "Bitcoin Price", "Who is X?")
           { "type": "system_action", "intent": "web_search", "entities": { "query": "current oscar winners", "type": "search" } }

        4. [CONVERSATION & MEMORY] ("Hi", "Tell me a joke", "What did I just say?", "What is my name?")
           { "type": "conversation", "response": "Your name is John." }

        IMPORTANT RULES:
        1. Decide if the user's input is a NEW TOPIC or a FOLLOW-UP question.
        2. If it is a completely NEW TOPIC (e.g. "Who is the CEO of Apple?"), IGNORE the history and use CATEGORY 3 (Web Search) or system actions.
        3. If it is a FOLLOW-UP question ("Why?", "What did I say?"), READ the History Data and answer using CATEGORY 4 (Conversation).
        4. Output PURE JSON ONLY. No Markdown, no extra text.

        EXAMPLE MEMORY BEHAVIOR (Follow-up):
        History: [{"role":"user", "content":"I live in Tokyo."}, {"role":"assistant", "content":"{...}"}]
        User: "Where do I live?"
        Your JSON: { "type": "conversation", "response": "You live in Tokyo." }

        EXAMPLE NEW TOPIC BEHAVIOR:
        History: [{"role":"user", "content":"I like dogs."}, {"role":"assistant", "content":"{...}"}]
        User: "Who won the superbowl?"
        Your JSON: { "type": "system_action", "intent": "web_search", "entities": { "query": "Who won the superbowl?", "type": "search" } }
    `;

    // Construct the stringified history preamble for small models like Phi-3
    let historyPreamble = "";
    if (chatHistory && chatHistory.length > 0) {
        historyPreamble = "CONVERSATION HISTORY:\n";
        chatHistory.forEach(msg => {
            historyPreamble += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
        });
        historyPreamble += "\nBASED ON THE ABOVE HISTORY, RESPOND TO THIS NEW INPUT:\n";
    }

    const finalUserText = historyPreamble + userText;

    // Construct the new Messages Array format for the Chat API
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalUserText } // Send history + new prompt grouped tightly
    ];

    try {
        // Send a POST request to the Chat API
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST", // HTTP Method
            headers: { "Content-Type": "application/json" }, // Standard JSON header
            body: JSON.stringify({
                model: MODEL_NAME, // The model we defined earlier
                messages: messages, // The detailed instructions + rolling window history
                stream: false, // We want the full response at once, not a stream
                format: "json", // Force Ollama to try and output JSON
                options: { num_predict: 200, temperature: 0.1 } // Limit output length and creativity
            })
        });

        // Parse the HTTP response body as JSON.
        const data = await response.json();
        // The API/chat endpoint puts the response in data.message.content
        const rawText = data.message?.content || "";
        console.log("Raw AI Reply:", rawText); // Log the raw output for debugging

        try {
            // --- PARSING LOGIC ---
            // The AI might return JSON wrapped in markdown, plain text, or an Array
            let parsed;

            try {
                parsed = JSON.parse(rawText);
                if (Array.isArray(parsed)) parsed = parsed[0]; // If it returns [ {type: ...} ], extract the object
            } catch (e) {
                // 2. If direct parsing fails, use Regex to find the first {...} block.
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("No JSON found");
                }
            }

            // --- NORMALIZATION STEP ---
            // Ensure the output format is consistent for the frontend/backend to handle.

            // If it's a conversation type but missing the 'response' key, try to find alternatives.
            if (!parsed.response && parsed.type === 'conversation') {
                parsed.response = parsed.reply || parsed.message || parsed.answer || parsed.content || parsed.text || "I am here.";
            }

            // If it's a system action but missing critical intent/entities, fallback to conversation.
            if (parsed.type === 'system_action' && !parsed.intent) {
                parsed = { type: 'conversation', response: "I am not sure what you want me to do." };
            }

            // --- 2. HEURISTIC OVERRIDE NO. 2: REFUSAL DETECTOR ---
            // Check if the AI refused to answer because of safety rails or knowledge cutoff.
            // If so, force a Web Search action instead.
            if (parsed.type === 'conversation') {
                const refusalPhrases = [
                    "cannot predict",
                    "future event",
                    "cutoff",
                    "last update",
                    "don't have real-time",
                    "unable to provide",
                    "cannot browse",
                    "text-based ai"
                ];

                const responseLower = (parsed.response || "").toLowerCase();
                // Check if the response contains any of the refusal phrases
                if (refusalPhrases.some(phrase => responseLower.includes(phrase))) {
                    console.log("Refusal Detected! Converting to Web Search.");
                    return {
                        type: "system_action",
                        intent: "web_search",
                        entities: {
                            query: userText, // Use original user text as search query
                            type: "search"
                        }
                    };
                }
            }

            return parsed; // Return the successfully parsed and normalized object
        } catch (e) {
            console.warn("JSON Parse Failed, using raw text fallback");
            // Fallback: If AI replies with plain text that isn't JSON, treat it as a conversation response.
            return { type: "conversation", "response": rawText || "I didn't quite catch that." };
        }
    } catch (error) {
        // Handle Network Errors (e.g., Ollama not running)
        console.error("Ollama Error:", error.message);
        return { type: "conversation", "response": "My brain is offline. Please check if Ollama is running." };
    }

}

/**
 * Generates a short title summarizing recent chat messages. Accept an AbortSignal for preemption.
 * @param {string} chatHistoryText - The text of the last few messages to summarize.
 * @param {AbortSignal} signal - Used to instantly map an abort to the internal fetch call.
 */
async function generateTitle(chatHistoryText, signal) {
    const systemPrompt = `
        You are DIVA. Write a very short 3-5 word title summarizing this conversation.
        Return ONLY JSON like this: { "title": "Your Title Here" }
        Do not add markdown, greetings, or any other text.
        Conversation:
        ${chatHistoryText}
    `;

    try {
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: systemPrompt,
                stream: false,
                format: "json",
                options: { num_predict: 50, temperature: 0.3 }
            }),
            signal: signal // Binds the fetch to the given AbortController
        });

        const data = await response.json();
        let parsed;
        try {
            parsed = JSON.parse(data.response);
        } catch (e) {
            const match = data.response.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { title: data.response };
        }

        // Clean Title
        let title = parsed.title || parsed.response || "Untitled Chat";
        title = title.replace(/["']/g, "").trim();
        if (title.length > 50) title = title.slice(0, 50);
        return title;
    } catch (err) {
        if (err.name === 'AbortError') {
            console.log("[OllamaService] Title generation aborted to serve user request.");
            throw err;
        }
        console.error("[OllamaService] Title Generation Error:", err.message);
        return null;
    }
}

// Export the function so it can be used in server.js
module.exports = { queryOllama, generateTitle };
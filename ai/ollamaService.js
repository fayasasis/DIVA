const MODEL_NAME = "phi3"; // Define the AI model to be used (Phi-3 Mini).

/**
 * Main function to query the local Ollama AI instance.
 * @param {string} userText - The input text or command from the user.
 * @returns {Promise<object>} - The structured JSON response from the AI.
 */
async function queryOllama(userText) {
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

        4. [CONVERSATION] (Use ONLY for greetings/jokes/philosophy: "Hi", "Tell me a joke", "meaning of life")
           { "type": "conversation", "response": "Hello! I am ready." }

        IMPORTANT RULES:
        - If the user asks for REAL-TIME info (News, Stock Prices, Sports, Weather, "Recent" events), YOU MUST USE CATEGORY 3 (Web Search).
        - Do NOT try to answer questions about 2024/2025/Future/Current events yourself. Use Web Search.
        - If unsure, default to Web Search.
        - Output PURE JSON ONLY. No Markdown.
        
        User Input: "${userText}"
    `;

    try {
        // Send a POST request to the local Ollama API.
        // Node 18+ has built-in fetch, so no external library is needed here.
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST", // HTTP Method
            headers: { "Content-Type": "application/json" }, // Standard JSON header
            body: JSON.stringify({
                model: MODEL_NAME, // The model we defined earlier
                prompt: systemPrompt, // The detailed instructions + user input
                stream: false, // We want the full response at once, not a stream
                format: "json", // Force Ollama to try and output JSON
                options: { num_predict: 200, temperature: 0.1 } // Limit output length and creativity (low temp = more deterministic)
            })
        });

        // Parse the HTTP response body as JSON.
        const data = await response.json();
        const rawText = data.response; // Extract the actual text string from Ollama
        console.log("Raw AI Reply:", rawText); // Log the raw output for debugging

        try {
            // --- PARSING LOGIC ---
            // The AI might return JSON wrapped in markdown or just plain text.

            // 1. Try direct JSON parsing first.
            let parsed;
            try {
                parsed = JSON.parse(rawText);
            } catch (e) {
                // 2. If direct parsing fails, use Regex to find the first {...} block.
                // This handles cases where AI adds "Here is your JSON:" prefix.
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]); // Parse the extracted JSON string
                } else {
                    throw new Error("No JSON found"); // Throw error if no JSON structure exists
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
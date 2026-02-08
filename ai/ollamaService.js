const MODEL_NAME = "phi3";

async function queryOllama(userText) {
    console.log(`🧠 AI Thinking (${MODEL_NAME})...`);

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
        // Using built-in fetch (Node 18+)
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: systemPrompt,
                stream: false,
                format: "json",
                options: { num_predict: 200, temperature: 0.1 }
            })
        });

        const data = await response.json();
        const rawText = data.response;
        console.log("🧠 Raw AI Reply:", rawText);

        try {
            // 1. Try direct parsing
            let parsed;
            try {
                parsed = JSON.parse(rawText);
            } catch (e) {
                // 2. Regex Extraction (Finds the first {...} block)
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("No JSON found");
                }
            }

            // --- NORMALIZATION STEP ---
            // Ensure 'response' key exists if it's a conversation type
            if (!parsed.response && parsed.type === 'conversation') {
                parsed.response = parsed.reply || parsed.message || parsed.answer || parsed.content || parsed.text || "I am here.";
            }

            // If it's a system action but missing critical fields, fallback to conversation
            if (parsed.type === 'system_action' && !parsed.intent) {
                parsed = { type: 'conversation', response: "I am not sure what you want me to do." };
            }

            // --- 2. HEURISTIC OVERRIDE NO. 2: REFUSAL DETECTOR 🚨 ---
            // If the AI refuses to answer because of "training data cutoff" or "future prediction",
            // we FORCE a web search instead.
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
                if (refusalPhrases.some(phrase => responseLower.includes(phrase))) {
                    console.log("🛡️ Refusal Detected! Converting to Web Search.");
                    return {
                        type: "system_action",
                        intent: "web_search",
                        entities: {
                            query: userText,
                            type: "search"
                        }
                    };
                }
            }

            return parsed;
        } catch (e) {
            console.warn("⚠️ JSON Parse Failed, using raw text fallback");
            // Fallback: If AI replies with plain text, treat it as a conversation
            return { type: "conversation", "response": rawText || "I didn't quite catch that." };
        }
    } catch (error) {
        console.error("❌ Ollama Error:", error.message);
        return { type: "conversation", "response": "My brain is offline. Please check if Ollama is running." };
    }

}

module.exports = { queryOllama };
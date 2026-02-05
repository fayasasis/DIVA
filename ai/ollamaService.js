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

        3. [Web Search] ("Search Google for AI", "Open YouTube")
           { "type": "system_action", "intent": "web_search", "entities": { "query": "AI news", "type": "search" } }

        4. [CONVERSATION & KNOWLEDGE] (Use this for "Hi", "How are you", "Who is Elon Musk?", "Tell me a joke", "What is time?")
           { "type": "conversation", "response": "WRITE_THE_ACTUAL_ANSWER_HERE" }

        IMPORTANT RULES:
        - If the user asks a question or wants to chat, YOU MUST use Category 4.
        - The "response" field in Category 4 must contain the string answer to the user (e.g., "I am doing well!").
        - Output PURE JSON ONLY. Do not write markdown.
        
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
                options: { num_predict: 200, temperature: 0.3 }
            })
        });

        const data = await response.json();
        const rawText = data.response;
        console.log("🧠 Raw AI Reply:", rawText);

        try {
            return JSON.parse(rawText);
        } catch (e) {
            // Fallback: If AI replies with plain text, treat it as a conversation
            return { type: "conversation", "response": rawText };
        }
    } catch (error) {
        console.error("❌ Ollama Error:", error.message);
        return { type: "conversation", "response": "My brain is offline. Please check if Ollama is running." };
    }
}

module.exports = { queryOllama };
// DIVA/ai/ollamaService.js

// We target the Phi-3 model
const MODEL_NAME = "phi3"; 

async function queryOllama(userText) {
    console.log(`🧠 AI Thinking (${MODEL_NAME})...`);

    // 1. The Strict System Prompt
    // Phi-3 is smart but can get chatty. We force JSON compliance.
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
        - Output PURE JSON only. No markdown.
        
        User Input: "${userText}"
    `;
    try {
        const response = await fetch("http://127.0.0.1:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: systemPrompt,
                stream: false,
                format: "json" // Force JSON mode
            })
        });

        const data = await response.json();
        const rawText = data.response;
        
        console.log("🧠 Raw AI Reply:", rawText);

        try {
            return JSON.parse(rawText);
        } catch (e) {
            // Fallback if Phi-3 hallucinates text around the JSON
            console.error("❌ JSON Parse Failed. Raw:", rawText);
            return { type: "conversation", response: rawText }; 
        }

    } catch (error) {
        console.error("❌ Ollama Offline?", error);
        return { type: "conversation", response: "My brain is offline. Is Ollama running?" };
    }
}

module.exports = { queryOllama };
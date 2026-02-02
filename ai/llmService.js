// This file handles talking to the AI (Ollama)
const LLM_API_URL = "http://127.0.0.1:11434/api/generate";

async function queryLLM(prompt) {
    try {
        const response = await fetch(LLM_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3.2",
                prompt: prompt,
                stream: false // We want the whole answer at once, not piece by piece
            })
        });

        const data = await response.json();
        return data.response; // This is the actual text the AI replied with

    } catch (error) {
        console.error("❌ Error talking to Ollama:", error);
        return "I am having trouble thinking right now.";
    }
}

module.exports = { queryLLM };
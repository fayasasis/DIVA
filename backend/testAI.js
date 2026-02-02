const { queryLLM } = require('./src/llm/llmService');

console.log("⏳ Asking AI a question...");

queryLLM("What is 2 + 2? Answer in one word.")
    .then(answer => {
        console.log("🤖 AI Answer:", answer);
    });
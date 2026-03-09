// ==============================
// LOCAL TEXT EMBEDDINGS UTILITY (Using Ollama)
// ==============================

// We use Ollama's built-in /api/embeddings route to avoid Node.js native build dependencies.

const OLLAMA_URL = "http://127.0.0.1:11434/api/embeddings";
const MODEL_NAME = "nomic-embed-text"; // Very fast embedding model

/**
 * Generates a numerical vector (embedding) for a given text using Ollama.
 * @param {string} text - The input text.
 * @returns {Promise<number[]>} - An array of floats representing the semantics of the text.
 */
async function getTextVector(text) {
    try {
        const response = await fetch(OLLAMA_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: text
            })
        });

        if (!response.ok) {
            console.warn(`Ollama embedding failed with status: ${response.status}. Make sure '${MODEL_NAME}' is pulled.`);
            return [];
        }

        const data = await response.json();
        return data.embedding; // Ollama returns { embedding: [0.1, -0.2...] }
    } catch (error) {
        console.error("Error generating vector via Ollama:", error.message);
        return [];
    }
}

/**
 * Calculates the Cosine Similarity between two vectors.
 * Score ranges from -1.0 (opposite) to 1.0 (identical).
 * @param {number[]} vecA - First vector
 * @param {number[]} vecB - Second vector
 * @returns {number} - Similarity score
 */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

module.exports = {
    getTextVector,
    cosineSimilarity
};

// A script to mimic the Frontend sending a request
async function testServer(text) {
    console.log(`\n📤 Sending: "${text}"`);
    
    // CHANGE: Use 127.0.0.1 instead of localhost to prevent lookup errors
    const response = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
    });

    const data = await response.json();
    console.log("📥 Received:", data);
}

// Run tests
(async () => {
    try {
        await testServer("Hello there");       // Should be conversation
        await testServer("Please open Chrome"); // Should be system_action
    } catch (error) {
        console.error("❌ Connection failed! Is server.js running in another terminal?");
    }
})();
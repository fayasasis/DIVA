const MODEL_NAME = "phi3";

async function queryOllama(userText, chatHistory = []) {
    console.log(`AI Thinking (${MODEL_NAME})...`);

    const systemPrompt = `
        You are DIVA, an advanced Desktop Assistant.
        Analyze the user's input and return strictly ONE JSON object.

        CATEGORIES:

        1. [App & Window Control] ("Open Notepad", "Close Chrome", "Minimize this", "Restart Spotify")
           { "type": "system_action", "intent": "app_control", "entities": { "action": "open", "target": "notepad" } }
           (actions: open, close, restart, minimize, maximize, switch_focus, show_desktop)

        2. [File Actions] - Use these EXACT formats:

           CREATE folder:
           "create a folder called test in downloads"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "create", "target": "test", "type": "folder", "location": "downloads" } }

           CREATE file:
           "create a text file called notes in documents"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "create", "target": "notes.txt", "type": "file", "location": "documents" } }

           DELETE:
           "delete test from downloads"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "delete", "targets": ["test"], "destination": "downloads" } }

           DELETE multiple:
           "delete folder A and file B"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "delete", "targets": ["A", "B"] } }

           LIST:
           "list files in documents"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "list", "target": "documents" } }

           RENAME:
           "rename pfort in documents to ppppppp"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "rename", "target": "pfort", "new_name": "ppppppp", "location": "documents" } }

           OPEN file or folder:
           "open downloads"
           { "type": "system_action", "intent": "file_action", "entities": { "action": "open", "target": "downloads" } }

        3. [System Control] ("Volume up", "Lock screen", "Brightness down", "Sleep")
           { "type": "system_action", "intent": "system_control", "entities": { "action": "volume_up" } }

        4. [Web Search] ("Search Google for AI", "Open YouTube", "Recent Oscar winners", "Bitcoin Price", "Who is X?")
           { "type": "system_action", "intent": "web_search", "entities": { "query": "current oscar winners", "type": "search" } }

        5. [CONVERSATION & MEMORY] ("Hi", "Tell me a joke", "What did I just say?", "What is my name?")
           { "type": "conversation", "response": "Your name is John." }

        IMPORTANT RULES:
        1. Decide if the user's input is a NEW TOPIC or a FOLLOW-UP question.
        2. If it is a completely NEW TOPIC (e.g. "Who is the CEO of Apple?"), IGNORE the history and use CATEGORY 4 (Web Search) or system actions.
        3. If it is a FOLLOW-UP question ("Why?", "What did I say?"), READ the History Data and answer using CATEGORY 5 (Conversation).
        4. Output PURE JSON ONLY. No Markdown, no extra text.
        5. For file actions, ALWAYS use the exact field names shown in the examples above.
        6. For CREATE, "target" must be ONLY the filename or folder name — never a descriptive phrase.
        7. For RENAME, always use "target" for the old name and "new_name" for the new name.

        EXAMPLE MEMORY BEHAVIOR (Follow-up):
        History: [{"role":"user", "content":"I live in Tokyo."}, {"role":"assistant", "content":"{...}"}]
        User: "Where do I live?"
        Your JSON: { "type": "conversation", "response": "You live in Tokyo." }

        EXAMPLE NEW TOPIC BEHAVIOR:
        History: [{"role":"user", "content":"I like dogs."}, {"role":"assistant", "content":"{...}"}]
        User: "Who won the superbowl?"
        Your JSON: { "type": "system_action", "intent": "web_search", "entities": { "query": "Who won the superbowl?", "type": "search" } }
    `;

    let historyPreamble = "";
    if (chatHistory && chatHistory.length > 0) {
        historyPreamble = "CONVERSATION HISTORY:\n";
        chatHistory.forEach(msg => {
            historyPreamble += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
        });
        historyPreamble += "\nBASED ON THE ABOVE HISTORY, RESPOND TO THIS NEW INPUT:\n";
    }

    const finalUserText = historyPreamble + userText;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalUserText }
    ];

    try {
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messages,
                stream: false,
                format: "json",
                options: { num_predict: 200, temperature: 0.1 }
            })
        });

        const data = await response.json();
        const rawText = data.message?.content || "";
        console.log("Raw AI Reply:", rawText);

        try {
            let parsed;
            try {
                parsed = JSON.parse(rawText);
                if (Array.isArray(parsed)) parsed = parsed[0];
            } catch (e) {
                const jsonMatch = rawText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    parsed = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error("No JSON found");
                }
            }

            if (!parsed.response && parsed.type === 'conversation') {
                parsed.response = parsed.reply || parsed.message || parsed.answer || parsed.content || parsed.text || "I am here.";
            }

            if (parsed.type === 'system_action' && !parsed.intent) {
                parsed = { type: 'conversation', response: "I am not sure what you want me to do." };
            }

            if (parsed.type === 'conversation') {
                const refusalPhrases = [
                    "cannot predict", "future event", "cutoff", "last update",
                    "don't have real-time", "unable to provide", "cannot browse", "text-based ai"
                ];
                const responseLower = (parsed.response || "").toLowerCase();
                if (refusalPhrases.some(phrase => responseLower.includes(phrase))) {
                    console.log("Refusal Detected! Converting to Web Search.");
                    return { type: "system_action", intent: "web_search", entities: { query: userText, type: "search" } };
                }
            }

            return parsed;
        } catch (e) {
            console.warn("JSON Parse Failed, using raw text fallback");
            return { type: "conversation", "response": rawText || "I didn't quite catch that." };
        }
    } catch (error) {
        console.error("Ollama Error:", error.message);
        return { type: "conversation", "response": "My brain is offline. Please check if Ollama is running." };
    }
}

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
            signal: signal
        });

        const data = await response.json();
        let parsed;
        try {
            parsed = JSON.parse(data.response);
        } catch (e) {
            const match = data.response.match(/\{[\s\S]*\}/);
            parsed = match ? JSON.parse(match[0]) : { title: data.response };
        }

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

module.exports = { queryOllama, generateTitle };
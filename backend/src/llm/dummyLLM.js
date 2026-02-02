function dummyLLM(userInput) {
  const text = userInput.toLowerCase();
  console.log("🧠 Brain analyzing:", text); // Debug log

  // --- Rule 1: Chrome ---
  if (text.includes("chrome")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "chrome" }
    };
  } 
  // --- Rule 2: VS Code ---
  else if (text.includes("vscode") || text.includes("code")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "vscode" }
    };
  } 
  // --- Rule 3: Notepad ---
  else if (text.includes("notepad")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "notepad" }
    };
  }
  // --- Rule 4: Calculator ---
  else if (text.includes("calculator") || text.includes("calc")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "calculator" }
    };
  }

  // Fallback -> Conversation
  return {
    type: "conversation",
    response: "Hello! I got your message. This is a dummy LLM response."
  };
}

module.exports = { dummyLLM };
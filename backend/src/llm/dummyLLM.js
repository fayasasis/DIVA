function dummyLLM(userInput) {
  const text = userInput.toLowerCase();

  // Simple rules for system actions
  if (text.includes("open") && text.includes("chrome")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "chrome" }
    };
  } else if (text.includes("open") && text.includes("vscode")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "vscode" }
    };
  } else if (text.includes("play") && text.includes("music")) {
    return {
      type: "system_action",
      intent: "play_music",
      entities: {}
    };
  }

  // Anything else → conversation
  return {
    type: "conversation",
    response: "Hello! I got your message. This is a dummy LLM response."
  };
}

module.exports = { dummyLLM };
// ==========================================
// 🧠 DUMMY LLM (RULE-BASED INTELLIGENCE)
// ==========================================
// This file simulates how a real LLM would behave.
// It classifies user input into:
// 1) system_action  → something the OS must do
// 2) conversation   → simple chat response

function dummyLLM(userInput) {

  // Convert input to lowercase for consistent matching
  const text = userInput.toLowerCase();

  // Debug log to show what the "brain" is analyzing
  console.log("🧠 Brain analyzing:", text);

  // ------------------------------------------
  // RULE 1: Detect Chrome open request
  // ------------------------------------------
  if (text.includes("chrome")) {
    return {
      type: "system_action",        // This requires OS action
      intent: "open_app",           // What action to perform
      entities: { app: "chrome" }   // On which application
    };
  } 

  // ------------------------------------------
  // RULE 2: Detect VS Code open request
  // ------------------------------------------
  else if (text.includes("vscode") || text.includes("code")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "vscode" }
    };
  } 

  // ------------------------------------------
  // RULE 3: Detect Notepad open request
  // ------------------------------------------
  else if (text.includes("notepad")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "notepad" }
    };
  }

  // ------------------------------------------
  // RULE 4: Detect Calculator open request
  // ------------------------------------------
  else if (text.includes("calculator") || text.includes("calc")) {
    return {
      type: "system_action",
      intent: "open_app",
      entities: { app: "calculator" }
    };
  }

  // ------------------------------------------
  // FALLBACK: Normal conversation
  // ------------------------------------------
  // If no system action is detected,
  // respond with a conversational reply
  return {
    type: "conversation",
    response: "Hello! I got your message. This is a dummy LLM response."
  };
}

// Export function so server.js can use it
module.exports = { dummyLLM };

// Import React and required React hooks
// useState  → to store UI data (messages, input, mic state)
// useEffect → to run code when messages change
// useRef    → to access DOM elements (for auto-scroll)
import React, { useState, useEffect, useRef } from 'react';

// Axios is used to send HTTP requests to the backend
import axios from 'axios';

// Import CSS styling for the UI
import './App.css'; 

// Main React component – this is the entire frontend app
function App() {

  // Stores the full chat history (user + bot messages)
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am DIVA. How can I help you?' }
  ]);

  // Stores the current text typed by the user
  const [inputText, setInputText] = useState("");

  // Stores AI-predicted suggestion (future action)
  const [suggestion, setSuggestion] = useState(null); 

  // Tracks whether microphone is recording or not
  const [isRecording, setIsRecording] = useState(false);
  
  // Reference to the last message (used for auto-scrolling)
  const chatEndRef = useRef(null);

  // Runs automatically whenever messages change
  // Scrolls chat window to the latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Called when user clicks Send or presses Enter
  const handleSend = async () => {

    // Prevent sending empty messages
    if (!inputText.trim()) return;

    // Create user message object
    const userMsg = { sender: 'user', text: inputText };

    // Add user message to chat UI
    setMessages((prev) => [...prev, userMsg]);

    // Clear input field
    setInputText(""); 

    // Remove old suggestion when new command is sent
    setSuggestion(null); 

    try {
      // Send user text to backend server
      const response = await axios.post(
        'http://127.0.0.1:5000/chat',
        { text: userMsg.text }
      );

      // Extract backend response
      const data = response.data;
      let botText = "";
      
      // If backend classifies it as conversation
      if (data.type === 'conversation') {
        botText = data.response;
      } 
      
      // If backend classifies it as system action
      else if (data.type === 'system_action') {
        botText = `Executing: ${data.intent} on ${data.entities.app || 'system'}`;

        // Temporary hardcoded suggestion (later from Markov model)
        setSuggestion("Open VS Code?"); 
      }

      // Add bot response to chat UI
      setMessages((prev) => [...prev, { sender: 'bot', text: botText }]);

    } catch (error) {
      // Handle backend connection failure
      console.error("Error talking to backend:", error);

      // Show error message in chat
      setMessages((prev) => [
        ...prev, 
        { sender: 'bot', text: "❌ Error: Backend is offline." }
      ]);
    }
  };

  // Detect Enter key press to send message
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  // Toggle microphone ON/OFF
  // (Actual voice logic will be added later)
  const toggleMic = () => {
    setIsRecording(!isRecording);

    if (!isRecording) {
      alert("Microphone logic coming soon!");
    }
  };

  // Accept AI suggestion and place it into input field
  const acceptSuggestion = () => {
    setInputText(suggestion); 
  };

  // UI layout rendered in browser
  return (
    <div className="app-container">

      {/* Header section */}
      <div className="header">
        <h1>🟦 DIVA Assistant</h1>
      </div>

      {/* Chat messages window */}
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}
          >
            {msg.text}
          </div>
        ))}

        {/* Invisible element used for auto-scroll */}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestion bar (shown only if suggestion exists) */}
      {suggestion && (
        <div className="suggestion-bar">
          <div className="suggestion-chip" onClick={acceptSuggestion}>
            💡 {suggestion}
          </div>
        </div>
      )}

      {/* Input section */}
      <div className="input-area">

        {/* Microphone button */}
        <button className="mic-btn" onClick={toggleMic}>
          {isRecording ? '🔴' : '🎤'}
        </button>
        
        {/* Text input field */}
        <input 
          type="text" 
          placeholder="Type a command..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        {/* Send button */}
        <button className="send-btn" onClick={handleSend}>
          📩 Send
        </button>

      </div>
    </div>
  );
}

// Export component so React can render it
export default App;

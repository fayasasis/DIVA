// ==============================
// IMPORTS (Tools we are using)
// ==============================

// React is the frontend library.
// useState      -> stores changing data (chat messages, input text, etc.)
// useEffect     -> runs code automatically when something loads or changes
// useRef        -> holds a reference to a DOM element (used for auto-scroll)
import React, { useState, useEffect, useRef } from 'react';

// Axios is used to send HTTP requests to the backend (Node.js server)
import axios from 'axios';

// socket.io-client allows real-time communication with backend (voice streaming)
import { io } from 'socket.io-client';

// CSS file for styling the UI
import './App.css';


// ==============================
// MAIN APP COMPONENT
// ==============================

function App() {

  // ------------------------------
  // STATE VARIABLES (Memory of UI)
  // ------------------------------

  // Stores all chat messages (user + bot)
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! Click the mic to speak.' }
  ]);

  // Stores what the user types in the input box
  const [inputText, setInputText] = useState("");

  // (Unused for now) – can be used later for AI suggestions
  const [suggestion, setSuggestion] = useState(null); 

  // Tracks whether microphone is currently recording
  const [isRecording, setIsRecording] = useState(false);

  // Stores the socket connection object
  const [socket, setSocket] = useState(null);

  // Reference to the bottom of the chat window (for auto-scroll)
  const chatEndRef = useRef(null);


  // ==============================
  // 🔊 TEXT TO SPEECH (VOICE OUTPUT)
  // ==============================

  // This function makes DIVA speak out loud
  const speak = (text) => {

    // Stop any previous speech so voices don't overlap
    window.speechSynthesis.cancel();

    // Create a speech object with the text
    const utterance = new SpeechSynthesisUtterance(text);

    // Voice customization (optional)
    // const voices = window.speechSynthesis.getVoices();
    // utterance.voice = voices[0];

    utterance.rate = 1;   // Speaking speed
    utterance.pitch = 1; // Voice pitch

    // Speak through system speakers
    window.speechSynthesis.speak(utterance);
  };


  // ==============================
  // 🔌 SOCKET.IO CONNECTION (Voice)
  // ==============================

  // This runs ONCE when the app loads
  useEffect(() => {

    // Connect frontend to backend socket server
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // When backend sends recognized voice text
    newSocket.on('voice_input', (text) => {
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: text }
      ]);
    });

    // When backend sends bot response
    newSocket.on('bot_response', (text) => {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: text }
      ]);

      // Make DIVA speak the response
      speak(text);
    });

    // Cleanup: disconnect socket when page closes
    return () => newSocket.disconnect();

  }, []); // Empty array = run only once


  // ==============================
  // ⬇️ AUTO SCROLL CHAT WINDOW
  // ==============================

  // Every time messages change, scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  // ==============================
  // 🎤 MICROPHONE BUTTON LOGIC
  // ==============================

  const toggleMic = () => {
    if (!socket) return;

    if (isRecording) {
      // Tell backend to stop listening
      socket.emit('stop_listening');
      setIsRecording(false);
    } else {
      // Tell backend to start listening
      socket.emit('start_listening');
      setIsRecording(true);
    }
  };


  // ==============================
  // 📩 SEND TEXT MESSAGE
  // ==============================

  const handleSend = async () => {

    // Ignore empty messages
    if (!inputText.trim()) return;

    // Add user message to chat UI
    const userMsg = { sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);

    // Clear input box
    setInputText(""); 

    try {
      // Send text to backend (/chat API)
      const response = await axios.post(
        'http://127.0.0.1:5000/chat',
        { text: userMsg.text }
      );

      const data = response.data;

      let botText = "";

      // If AI says it's a conversation
      if (data.type === 'conversation') {
        botText = data.response;
      }
      // If AI decided to do a system action
      else if (data.type === 'system_action') {
        botText = data.response || `Executing: ${data.intent}`;
      }

      // Add bot response to chat UI
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: botText }
      ]);

      // Make DIVA speak
      speak(botText);

    } catch (error) {
      console.error(error);
    }
  };


  // ==============================
  // ⌨️ ENTER KEY SUPPORT
  // ==============================

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };


  // ==============================
  // 🖥️ USER INTERFACE (HTML)
  // ==============================

  return (
    <div className="app-container">

      {/* Header */}
      <div className="header">
        <h1>🟦 DIVA Assistant</h1>
      </div>

      {/* Chat Messages */}
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div 
            key={index}
            className={`message ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}
          >
            {msg.text}
          </div>
        ))}

        {/* Mic indicator */}
        {isRecording && (
          <div className="listening-indicator">
            🔴 Listening...
          </div>
        )}

        {/* Auto-scroll anchor */}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">

        {/* Microphone Button */}
        <button 
          className={`mic-btn ${isRecording ? 'recording' : ''}`} 
          onClick={toggleMic}
        >
          {isRecording ? '🟥' : '🎤'}
        </button>

        {/* Text Input */}
        <input 
          type="text" 
          placeholder="Type a command..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
        />

        {/* Send Button */}
        <button className="send-btn" onClick={handleSend}>
          📩
        </button>

      </div>
    </div>
  );
}

export default App;

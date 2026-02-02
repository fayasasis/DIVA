import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css'; 

function App() {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am DIVA. How can I help you?' }
  ]);
  const [inputText, setInputText] = useState("");
  const [suggestion, setSuggestion] = useState(null); 
  const [isRecording, setIsRecording] = useState(false);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg = { sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInputText(""); 
    setSuggestion(null); 

    try {
      const response = await axios.post('http://127.0.0.1:5000/chat', {
        text: userMsg.text
      });

      const data = response.data;
      let botText = "";
      
      if (data.type === 'conversation') {
        botText = data.response;
      } else if (data.type === 'system_action') {
        botText = `Executing: ${data.intent} on ${data.entities.app || 'system'}`;
        setSuggestion("Open VS Code?"); 
      }

      setMessages((prev) => [...prev, { sender: 'bot', text: botText }]);

    } catch (error) {
      console.error("Error talking to backend:", error);
      setMessages((prev) => [...prev, { sender: 'bot', text: "❌ Error: Backend is offline." }]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const toggleMic = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
        alert("Microphone logic coming soon!");
    }
  };

  const acceptSuggestion = () => {
    setInputText(suggestion); 
  };

  return (
    <div className="app-container">
      <div className="header">
        <h1>🟦 DIVA Assistant</h1>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
            {msg.text}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {suggestion && (
        <div className="suggestion-bar">
          <div className="suggestion-chip" onClick={acceptSuggestion}>
            💡 {suggestion}
          </div>
        </div>
      )}

      <div className="input-area">
        <button className="mic-btn" onClick={toggleMic}>
          {isRecording ? '🔴' : '🎤'}
        </button>
        
        <input 
          type="text" 
          placeholder="Type a command..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <button className="send-btn" onClick={handleSend}>
          📩 Send
        </button>
      </div>
    </div>
  );
}

export default App;
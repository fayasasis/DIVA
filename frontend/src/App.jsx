import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! Click the mic to speak.' }
  ]);
  const [inputText, setInputText] = useState("");
  const [suggestion, setSuggestion] = useState(null); 
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState(null);
  
  const chatEndRef = useRef(null);

  // --- 🔊 NEW: VOICE OUTPUT ENGINE ---
  const speak = (text) => {
    // Stop any previous speech so they don't overlap
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Optional: Customize the voice
    // const voices = window.speechSynthesis.getVoices();
    // utterance.voice = voices[0]; // 0 is usually the default system voice
    
    utterance.rate = 1; // Speed (0.1 to 10)
    utterance.pitch = 1; // Pitch (0 to 2)
    
    window.speechSynthesis.speak(utterance);
  };

  // --- SOCKET CONNECTION ---
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('voice_input', (text) => {
      setMessages((prev) => [...prev, { sender: 'user', text: text }]);
    });

    newSocket.on('bot_response', (text) => {
      setMessages((prev) => [...prev, { sender: 'bot', text: text }]);
      speak(text); // <--- DIVA SPEAKS HERE (Voice Response)
    });

    return () => newSocket.disconnect();
  }, []);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- MIC BUTTON LOGIC ---
  const toggleMic = () => {
    if (!socket) return;
    if (isRecording) {
      socket.emit('stop_listening');
      setIsRecording(false);
    } else {
      socket.emit('start_listening');
      setIsRecording(true);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userMsg = { sender: 'user', text: inputText };
    setMessages((prev) => [...prev, userMsg]);
    setInputText(""); 
    
    try {
      const response = await axios.post('http://127.0.0.1:5000/chat', { text: userMsg.text });
      const data = response.data;
      
      let botText = "";
      if (data.type === 'conversation') {
        botText = data.response;
      } else if (data.type === 'system_action') {
        botText = data.response || `Executing: ${data.intent}`;
      }
      
      setMessages((prev) => [...prev, { sender: 'bot', text: botText }]);
      speak(botText); // <--- DIVA SPEAKS HERE (Text Response)

    } catch (error) {
        console.error(error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
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
        {isRecording && <div className="listening-indicator">🔴 Listening...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="input-area">
        <button 
          className={`mic-btn ${isRecording ? 'recording' : ''}`} 
          onClick={toggleMic}
        >
          {isRecording ? '🟥' : '🎤'}
        </button>
        
        <input 
          type="text" 
          placeholder="Type a command..." 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <button className="send-btn" onClick={handleSend}>
          📩
        </button>
      </div>
    </div>
  );
}

export default App;
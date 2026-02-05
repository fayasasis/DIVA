import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

function App() {
  // Start with a clean slate every time
  const [messages, setMessages] = useState([
    { sender: 'bot', text: 'Hello! I am ready. Click the mic or type.' }
  ]);
  const [history, setHistory] = useState([]); 
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showHistory, setShowHistory] = useState(false); 
  
  const chatEndRef = useRef(null);

  // --- 1. SETUP ---
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('voice_input', (text) => addMessage('user', text));
    newSocket.on('bot_response', (text) => {
        addMessage('bot', text);
        speak(text);
    });

    // Fetch history ONLY for the sidebar
    fetchHistory();

    return () => newSocket.disconnect();
  }, []);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
      try {
          const res = await axios.get('http://localhost:5000/history');
          // FIX: Only set history state, DO NOT load into main messages
          setHistory(res.data); 
      } catch (err) { console.error("No history"); }
  };

  const addMessage = (sender, text) => {
      setMessages(prev => [...prev, { sender, text }]);
  };

  const speak = (text) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(u);
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    addMessage('user', inputText);
    setInputText(""); 

    try {
      const res = await axios.post('http://localhost:5000/chat', { text: inputText });
      const botText = res.data.response || "Done";
      addMessage('bot', botText);
      speak(botText);
      // Refresh sidebar so new chat appears there too
      fetchHistory(); 
    } catch (e) { console.error(e); }
  };

  const toggleMic = () => {
      if(!socket) return;
      if(isRecording) { socket.emit('stop_listening'); setIsRecording(false); }
      else { socket.emit('start_listening'); setIsRecording(true); }
  };

  return (
    <div className="app-container">
      {/* SIDEBAR - Tucks away history */}
      <div className={`sidebar ${showHistory ? 'open' : ''}`}>
        <div className="sidebar-header">
            <h3>📜 Past Chats</h3>
            {/* Close button inside sidebar */}
            <button className="close-btn" onClick={() => setShowHistory(false)}>✖</button>
        </div>
        <div className="history-list">
            {history.map((h, i) => (
                <div key={i} className="history-item">
                    <span className="role">{h.role === 'user' ? '👤' : '🤖'}</span>
                    <span className="text">{(h.message || "Invalid Message").substring(0, 40)}...</span>
                </div>
            ))}
        </div>
      </div>

      <div className="main-content">
          <div className="header">
            {/* Toggle Button moved to the left side */}
            <button className="menu-btn" onClick={() => setShowHistory(!showHistory)}>
                ☰
            </button>
            <h1>🟦 DIVA Assistant</h1>
          </div>

          <div className="chat-area">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender === 'user' ? 'user-msg' : 'bot-msg'}`}>
                {msg.text}
              </div>
            ))}
            {isRecording && <div className="indicator">🔴 Listening...</div>}
            {/* Invisible element to scroll to */}
            <div ref={chatEndRef} />
          </div>

          <div className="input-area">
            <button className={`mic-btn ${isRecording ? 'rec' : ''}`} onClick={toggleMic}>
                {isRecording ? '🟥' : '🎤'}
            </button>
            <input 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyPress={e=> e.key==='Enter' && handleSend()} 
                placeholder="Type command..." 
            />
            <button className="send-btn" onClick={handleSend}>📩</button>
          </div>
      </div>
    </div>
  );
}

export default App;
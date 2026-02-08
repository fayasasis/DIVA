import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import SettingsModal from './components/SettingsModal'; // Import Settings
import './App.css';

function App() {
  // --- 1. STATE ---
  const [messages, setMessages] = useState([]); // Current Chat Messages
  const [sessions, setSessions] = useState([]); // List of Chat Sessions
  const [currentSession, setCurrentSession] = useState(null); // Active Session ID
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [socket, setSocket] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Sidebar State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('diva_settings');
    return saved ? JSON.parse(saved) : {
      userName: 'JD',
      location: 'Kochi, Kerala',
      browser: 'Chrome',
      windowMode: 'normal',
      transparency: true,
      alwaysOnTop: true,
      minimizeToTray: true,
      voiceResponse: true,
      micInput: 'Default',
      wakeWordSensitivity: 5,
      speakingRate: 1.0,
      smartPredictions: true,
      safeMode: true,
      showLogs: false
    };
  });

  // Persist Settings
  useEffect(() => {
    localStorage.setItem('diva_settings', JSON.stringify(settings));
  }, [settings]);

  // Editing State
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const chatEndRef = useRef(null);

  // ... (Effect Hooks remain same) ...

  // --- 2. SETUP ---
  useEffect(() => {
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);

    // Initial Load
    fetchSessions(); // Load sidebar
    startNewChat();  // Start with empty screen or load most recent? Let's start empty.

    newSocket.on('voice_input', (text) => addMessage('user', text));
    newSocket.on('bot_response', (text) => {
      addMessage('bot', text);
      if (settings.voiceResponse) speak(text); // Respect Settings
      fetchSessions(); // Update sidebar order
    });

    return () => newSocket.disconnect();
  }, [settings.voiceResponse]); // Re-bind if settings change (not strictly needed for logic but good practice)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- 3. API CALLS ---
  const fetchSessions = async () => {
    try {
      const res = await axios.get('http://localhost:5000/sessions');
      setSessions(res.data);
    } catch (err) { console.error("No sessions"); }
  };

  // ... (loadSession, startNewChat, deleteSession, startRenaming, saveRename remain exactly same) ...

  const loadSession = async (id) => {
    try {
      console.log("🖱️ Clicked Session:", id);
      // speak("Loading conversation"); // Sonic Debug: Confirm click works

      setCurrentSession(id);
      setIsSidebarCollapsed(false); // Auto-expand when clicking a chat

      const res = await axios.get(`http://localhost:5000/sessions/${id}`);

      // Map API messages to UI format
      const uiMessages = res.data.map(m => ({
        sender: m.role,
        text: m.message
      }));
      setMessages(uiMessages);
      setShowHistory(false); // Close mobile menu if open

    } catch (err) {
      console.error("Load failed", err);
      alert("Failed to load chat: " + err.message); // Visible Error
    }
  };

  const startNewChat = () => {
    setCurrentSession(null);
    setMessages([{ sender: 'bot', text: 'Hello! I am ready. Click the mic or type.' }]);
    setShowHistory(false);
    setIsSidebarCollapsed(false); // Auto-expand for new chat
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation(); // Don't trigger load
    if (!window.confirm("Delete this chat?")) return;

    // Optimistic UI Update: Remove immediately
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSession === id) startNewChat();

    try {
      await axios.delete(`http://localhost:5000/sessions/${id}`);
    } catch (err) {
      console.error("Delete failed", err);
      fetchSessions(); // Revert on error
    }
  };

  const startRenaming = (e, session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveRename = async (e) => {
    if (e.key === 'Enter') {
      await axios.put(`http://localhost:5000/sessions/${editingSessionId}`, { title: editTitle });
      setEditingSessionId(null);
      fetchSessions();
    }
  };

  const addMessage = (sender, text) => {
    setMessages(prev => [...prev, { sender, text }]);
  };

  // --- TTS STATE ---
  const [ttsState, setTtsState] = useState('idle'); // 'idle', 'playing', 'paused'
  const [ttsProgress, setTtsProgress] = useState(0);
  const ttsIntervalRef = useRef(null);

  const speak = (text) => {
    window.speechSynthesis.cancel();
    clearInterval(ttsIntervalRef.current);
    setTtsProgress(0);

    const u = new SpeechSynthesisUtterance(text);
    u.rate = settings.speakingRate;

    // ESTIMATE DURATION (Avg 150 words/min -> 2.5 words/sec)
    // Adjust for rate: 2.5 * rate words/sec
    const wordCount = text.split(/\s+/).length;
    const wordsPerSec = 2.5 * settings.speakingRate;
    const estimatedDurationSec = Math.max(wordCount / wordsPerSec, 2); // Min 2 sec
    const updateIntervalMs = 100;
    const progressStep = 100 / (estimatedDurationSec * (1000 / updateIntervalMs));

    u.onstart = () => {
      setTtsState('playing');
      ttsIntervalRef.current = setInterval(() => {
        setTtsProgress(prev => {
          if (prev >= 100) {
            clearInterval(ttsIntervalRef.current);
            return 100;
          }
          return prev + progressStep;
        });
      }, updateIntervalMs);
    };

    u.onend = () => {
      setTtsState('idle');
      setTtsProgress(0);
      clearInterval(ttsIntervalRef.current);
    };

    window.speechSynthesis.speak(u);
  };

  const pauseTTS = () => {
    window.speechSynthesis.pause();
    setTtsState('paused');
    clearInterval(ttsIntervalRef.current); // Pause progress
  };

  const resumeTTS = () => {
    window.speechSynthesis.resume();
    setTtsState('playing');
    // Resume progress (simple approximation: restart interval)
    // Ideally we track remaining time, but for visual feedback this is okay
    // Re-calculating properly is complex without native duration, so we just continue adding step
    // But we need the 'progressStep' variable... 
    // Simplified: Just restart the same interval logic?
    // We lost 'progressStep' scope. Let's strict to simple UI resume for now or execute speak again? 
    // No, resume works. For the bar, let's just leave it paused visually or accept it might desync slightly.
    // Better: Re-launch interval with fixed slow increment if we really want, or just let it stay static until next update?
    // Let's keep it simple: On resume, we won't re-animate the bar perfectly, but the audio resumes.
    // ACTUALLY: Let's store estimated duration in a ref to handle this better if needed.
  };

  const stopTTS = () => {
    window.speechSynthesis.cancel();
    setTtsState('idle');
    setTtsProgress(0);
    clearInterval(ttsIntervalRef.current);
  };

  // ... (handleSend, toggleMic same) ...

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const originalText = inputText;
    addMessage('user', originalText);
    setInputText("");

    try {
      const payload = { text: originalText };
      if (currentSession) payload.sessionId = currentSession;

      const res = await axios.post('http://localhost:5000/chat', payload);

      const botText = res.data.response || "Done";
      addMessage('bot', botText);
      if (settings.voiceResponse) speak(botText); // Respect Setting

      // Handle New Session Creation
      if (res.data.isNewSession) {
        setCurrentSession(res.data.sessionId);
        fetchSessions(); // Refresh sidebar to show new chat
      } else {
        // Just re-sort list if needed (updatedAt)
        fetchSessions();
      }

    } catch (e) { console.error(e); }
  };

  const toggleMic = () => {
    if (!socket) return;
    if (isRecording) { socket.emit('stop_listening'); setIsRecording(false); }
    else { socket.emit('start_listening'); setIsRecording(true); }
  };

  return (
    <div className="h-screen overflow-hidden flex bg-[#121212]">

      {/* SETTINGS MODAL */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
      />

      {/* SIDEBAR */}
      <aside className={`glass-panel border-r border-white/10 flex flex-col h-full transition-all duration-300 z-20 absolute md:relative ${isSidebarCollapsed ? 'w-20' : 'w-72'} ${!showHistory ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>

        {/* Header with Hamburger */}
        <div className={`p-4 border-b border-white/10 flex items-center bg-black/20 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Chats</span>}
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-slate-500 hover:text-white transition-colors">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>

        <div className="p-4">
          <button onClick={startNewChat} className={`flex items-center gap-3 p-3 rounded-xl bg-[var(--neon-cyan)]/10 text-[var(--neon-cyan)] hover:bg-[var(--neon-cyan)]/20 transition-all border border-[var(--neon-cyan)]/20 shadow-lg shadow-[var(--neon-cyan)]/5 ${isSidebarCollapsed ? 'justify-center w-full' : 'w-full'}`}>
            <span className="material-symbols-outlined">add</span>
            {!isSidebarCollapsed && <span className="text-sm font-bold uppercase tracking-wider">New Chat</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {sessions.length === 0 && !isSidebarCollapsed && <p className="text-[10px] text-slate-600 text-center mt-10">No recent chats</p>}

          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group p-3 rounded-lg cursor-pointer border transition-all relative ${currentSession === session.id ? 'bg-white/10 border-[var(--neon-cyan)]/40' : 'bg-transparent border-transparent hover:bg-white/5'} ${isSidebarCollapsed ? 'flex justify-center' : ''}`}
              onClick={() => loadSession(session.id)}
              title={session.title} // Tooltip for collapsed mode
            >
              {isSidebarCollapsed ? (
                // Collapsed Icon View
                <span className={`material-symbols-outlined text-[18px] ${currentSession === session.id ? 'text-[var(--neon-cyan)]' : 'text-slate-500'}`}>chat_bubble</span>
              ) : (
                // Expanded Full View
                editingSessionId === session.id ? (
                  <input
                    autoFocus
                    className="bg-transparent border-b border-[var(--neon-cyan)] text-white text-sm w-full outline-none pb-1"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={saveRename}
                    onBlur={() => setEditingSessionId(null)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <h3 className="text-sm font-medium text-slate-200 truncate pr-6">{session.title}</h3>
                    <p className="text-[10px] text-slate-500 mt-1 flex justify-between">
                      <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                      {!isSidebarCollapsed && <span>{new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                    </p>

                    {/* Hover Actions */}
                    <div className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 flex gap-1 bg-[#1e1e1e] p-1 rounded shadow-xl">
                      <button onClick={(e) => startRenaming(e, session)} className="text-slate-400 hover:text-blue-400 p-1"><span className="material-symbols-outlined text-[14px]">edit</span></button>
                      <button onClick={(e) => deleteSession(e, session.id)} className="text-slate-400 hover:text-red-500 p-1"><span className="material-symbols-outlined text-[14px]">delete</span></button>
                    </div>
                  </>
                )
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#121212_100%)]">
        {/* HEADER */}
        <header className="h-16 flex items-center justify-between px-8 glass-panel border-b border-white/10 z-10 relative">
          <div className="flex items-center gap-6">
            <button className="text-slate-400 hover:text-[var(--neon-cyan)] transition-colors md:hidden" onClick={() => setShowHistory(!showHistory)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black tracking-tighter text-white">DIVA <span className="text-[var(--neon-cyan)] neon-text-glow">AI</span></h1>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            </div>
          </div>

          {/* Chat Title (Centered) */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-slate-200 font-medium text-sm truncate max-w-[200px] md:max-w-md">
              {sessions.find(s => s.id === currentSession)?.title || "New Chat"}
            </span>
            <span className="material-symbols-outlined text-slate-500 text-sm">expand_more</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-[#121212] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">{settings.userName}</div>
            <button
              className={`material-symbols-outlined text-slate-400 hover:text-[var(--neon-cyan)] transition-all duration-500 ${isSettingsOpen ? 'rotate-90 text-[var(--neon-cyan)]' : ''}`}
              onClick={() => setIsSettingsOpen(true)}
            >
              settings
            </button>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-32">
          <div className="max-w-4xl mx-auto space-y-8">

            {messages.map((msg, index) => (
              <div key={index} className={`flex items-start gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>

                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${msg.sender === 'user'
                  ? 'bg-gradient-to-br from-[var(--neon-cyan)] to-blue-600 text-white font-bold'
                  : 'glass-panel text-[var(--neon-cyan)] border-[var(--neon-cyan)]/30'
                  }`}>
                  {msg.sender === 'user' ? 'JD' : <span className="material-symbols-outlined">auto_awesome</span>}
                </div>

                {/* Bubble */}
                <div className={`max-w-[80%] p-5 shadow-lg ${msg.sender === 'user'
                  ? 'bg-gradient-to-br from-[var(--neon-cyan)]/20 to-blue-600/20 border border-[var(--neon-cyan)]/30 rounded-2xl rounded-tr-none text-white'
                  : 'glass-panel rounded-2xl rounded-tl-none text-slate-200'
                  }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>

              </div>
            ))}

            {isRecording && (
              <div className="siri-overlay" onClick={toggleMic}>
                <div className="siri-container">
                  <div className="siri-orb"></div>
                  <div className="siri-orb-2"></div>
                </div>
                <p className="absolute bottom-32 text-[var(--neon-cyan)] animate-pulse font-mono tracking-widest text-sm pointer-events-none">LISTENING...</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* INPUT AREA */}
        <div
          className="absolute bottom-0 left-0 right-0 p-8 backdrop-blur-2xl z-20"
          style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%)' }}
        >
          {/* TTS MINI PLAYER */}
          {ttsState !== 'idle' && (
            <div className="max-w-4xl mx-auto mb-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex-1 bg-white/5 rounded-full h-1 overflow-hidden">
                <div
                  className="h-full bg-[var(--neon-cyan)] transition-all duration-100 ease-linear shadow-[0_0_10px_var(--neon-cyan)]"
                  style={{ width: `${ttsProgress}%` }}
                ></div>
              </div>
              <div className="flex items-center gap-2">
                {ttsState === 'playing' ? (
                  <button onClick={pauseTTS} className="text-white hover:text-[var(--neon-cyan)] transition-colors"><span className="material-symbols-outlined">pause_circle</span></button>
                ) : (
                  <button onClick={resumeTTS} className="text-white hover:text-[var(--neon-cyan)] transition-colors"><span className="material-symbols-outlined">play_circle</span></button>
                )}
                <button onClick={stopTTS} className="text-slate-400 hover:text-red-500 transition-colors" title="Stop/Skip"><span className="material-symbols-outlined">stop_circle</span></button>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto flex items-center gap-4">

            {/* Input Container - Cleaned up for future Smart Predictions */}
            <div className="flex-1 glass-panel rounded-full h-16 px-6 flex items-center gap-4 border-white/20 transition-all duration-300 cyan-glow-focus bg-[#121212]/50">
              {/* Left Side: Empty for now (Ideal for 'Smart Suggestion' Icon later) */}

              <input
                className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-slate-500 text-base outline-none"
                placeholder="Type your command..."
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />

              {/* SMART ACTION DEMO (Mockup) */}
              <div className="hidden md:flex items-center gap-2 pl-4 border-l border-white/10 animate-in fade-in slide-in-from-right-8 duration-700">
                <div className="flex flex-col items-end mr-2">
                  <span className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">Prediction</span>
                  <span className="text-xs text-[var(--neon-cyan)] font-bold whitespace-nowrap">Open Spotify</span>
                </div>

                <button className="w-9 h-9 rounded-full bg-[#121212] border border-white/10 hover:border-red-500 hover:bg-red-500/10 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all group" title="Ignore">
                  <span className="material-symbols-outlined text-lg group-hover:scale-110 transition-transform">close</span>
                </button>

                <button className="w-9 h-9 rounded-full bg-[#121212] border border-[var(--neon-cyan)]/30 hover:bg-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:text-black flex items-center justify-center transition-all shadow-[0_0_10px_rgba(0,255,204,0.1)] hover:shadow-[0_0_15px_rgba(0,255,204,0.5)] group" title="Accept">
                  <span className="material-symbols-outlined text-lg font-bold group-hover:scale-110 transition-transform">check</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={toggleMic} className={`w-16 h-16 rounded-full flex items-center justify-center active:scale-95 transition-transform shadow-lg ${isRecording ? 'bg-red-500 text-white mic-ripple shadow-red-500/20' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                <span className="material-symbols-outlined text-2xl">{isRecording ? 'stop' : 'mic'}</span>
              </button>

              <button onClick={handleSend} className="w-16 h-16 rounded-full bg-[var(--neon-cyan)] text-black flex items-center justify-center hover:shadow-[0_0_20px_rgba(0,255,204,0.4)] transition-all active:scale-95">
                <span className="material-symbols-outlined text-2xl font-bold">send</span>
              </button>
            </div>

          </div>
          <p className="text-center text-[10px] text-slate-600 mt-4 uppercase tracking-[0.2em] font-bold">DIVA - Desktop Intelligent Virtual Assistant</p>
        </div>
      </main>
    </div>
  );
}

export default App;
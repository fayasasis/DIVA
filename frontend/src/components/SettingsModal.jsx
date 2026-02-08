import React, { useState } from 'react';

const SettingsModal = ({ isOpen, onClose, settings, setSettings }) => {
    if (!isOpen) return null;

    const handleChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const sections = [
        { id: 'profile', icon: 'person', label: 'Profile' },
        { id: 'appearance', icon: 'palette', label: 'Appearance' },
        { id: 'voice', icon: 'graphic_eq', label: 'Voice' },
        { id: 'intelligence', icon: 'psychology', label: 'Intelligence' },
        { id: 'dev', icon: 'terminal', label: 'Developer' }
    ];

    const [activeTab, setActiveTab] = useState('profile');

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}>
            <div className="w-[800px] h-[600px] glass-panel rounded-2xl flex overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 slide-in-from-right-10" onClick={e => e.stopPropagation()}>

                {/* SIDEBAR TABS */}
                <div className="w-64 bg-black/20 border-r border-white/10 p-4 flex flex-col gap-2">
                    <h2 className="text-xl font-bold text-white mb-6 pl-4 tracking-tight">Settings</h2>

                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => setActiveTab(section.id)}
                            className={`flex items-center gap-3 p-3 rounded-xl transition-all text-sm font-medium ${activeTab === section.id ? 'bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
                        >
                            <span className="material-symbols-outlined">{section.icon}</span>
                            {section.label}
                        </button>
                    ))}

                    <div className="mt-auto p-4 border-t border-white/10">
                        <p className="text-[10px] text-slate-500 text-center">DIVA Config v1.0</p>
                    </div>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 bg-[#121212]/50 p-8 overflow-y-auto custom-scrollbar relative">
                    <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>

                    {/* 1. PROFILE */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">Profile & Personalization</h3>
                                <p className="text-xs text-slate-500">Teach DIVA who you are.</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">User Name</label>
                                    <input
                                        type="text"
                                        value={settings.userName}
                                        onChange={e => handleChange('userName', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--neon-cyan)] outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Location</label>
                                    <input
                                        type="text"
                                        value={settings.location}
                                        onChange={e => handleChange('location', e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-[var(--neon-cyan)] outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Preferred Browser</label>
                                    <select
                                        value={settings.browser}
                                        onChange={e => handleChange('browser', e.target.value)}
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-3 text-white focus:border-[var(--neon-cyan)] outline-none transition-colors"
                                    >
                                        <option value="Chrome">Google Chrome</option>
                                        <option value="Edge">Microsoft Edge</option>
                                        <option value="Firefox">Firefox</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. APPEARANCE */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">Appearance & Behavior</h3>
                                <p className="text-xs text-slate-500">Customize visual style.</p>
                            </div>

                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Window Mode</h4>
                                        <p className="text-[10px] text-slate-500">Shrink to widget or full chat.</p>
                                    </div>
                                    <div className="flex bg-black/30 rounded-lg p-1">
                                        <button
                                            onClick={() => handleChange('windowMode', 'normal')}
                                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${settings.windowMode === 'normal' ? 'bg-[var(--neon-cyan)] text-black shadow-lg' : 'text-slate-500'}`}
                                        >
                                            Normal
                                        </button>
                                        <button
                                            onClick={() => handleChange('windowMode', 'widget')}
                                            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${settings.windowMode === 'widget' ? 'bg-[var(--neon-cyan)] text-black shadow-lg' : 'text-slate-500'}`}
                                        >
                                            Widget
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {[
                                    { id: 'transparency', label: 'Transparency Effects', sub: 'Enable glassmorphism blur.' },
                                    { id: 'alwaysOnTop', label: 'Always on Top', sub: 'Keep floating over other apps.' },
                                    { id: 'minimizeToTray', label: 'Minimize to System Tray', sub: 'Hide in taskbar corner instead of quit.' },
                                ].map(toggle => (
                                    <div key={toggle.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors">
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-200">{toggle.label}</h4>
                                            <p className="text-[10px] text-slate-500">{toggle.sub}</p>
                                        </div>
                                        <button
                                            onClick={() => handleChange(toggle.id, !settings[toggle.id])}
                                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${settings[toggle.id] ? 'bg-[var(--neon-cyan)]' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings[toggle.id] ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 3. VOICE */}
                    {activeTab === 'voice' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">Voice & Audio</h3>
                                <p className="text-xs text-slate-500">Configure ears and mouth.</p>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 mb-6">
                                <div>
                                    <h4 className="text-sm font-bold text-white">Voice Response</h4>
                                    <p className="text-[10px] text-slate-500">Enable Text-to-Speech replies.</p>
                                </div>
                                <button
                                    onClick={() => handleChange('voiceResponse', !settings.voiceResponse)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${settings.voiceResponse ? 'bg-[var(--neon-cyan)]' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.voiceResponse ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Microphone Input</label>
                                    <select
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg p-3 text-white focus:border-[var(--neon-cyan)] outline-none transition-colors"
                                    >
                                        <option>Default System Microphone</option>
                                        <option>Headset Microphone (Realtek Audio)</option>
                                    </select>
                                </div>

                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Speaking Rate</label>
                                        <span className="text-xs text-[var(--neon-cyan)]">{settings.speakingRate}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={settings.speakingRate}
                                        onChange={e => handleChange('speakingRate', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--neon-cyan)]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. INTELLIGENCE */}
                    {activeTab === 'intelligence' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">Intelligence & Privacy</h3>
                                <p className="text-xs text-slate-500">Manage AI brain functions.</p>
                            </div>

                            <div className="space-y-2 mb-8">
                                {[
                                    { id: 'smartPredictions', label: 'Smart Predictions', sub: 'Show suggestion pills in chat.' },
                                    { id: 'safeMode', label: 'Safe Mode', sub: 'Require confirmation for sensitive commands.' },
                                ].map(toggle => (
                                    <div key={toggle.id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-lg transition-colors">
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-200">{toggle.label}</h4>
                                            <p className="text-[10px] text-slate-500">{toggle.sub}</p>
                                        </div>
                                        <button
                                            onClick={() => handleChange(toggle.id, !settings[toggle.id])}
                                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${settings[toggle.id] ? 'bg-[var(--neon-cyan)]' : 'bg-slate-700'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings[toggle.id] ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                    <span className="material-symbols-outlined text-2xl">delete_forever</span>
                                    <span className="text-sm font-bold">Clear History</span>
                                </button>
                                <button className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-[var(--neon-cyan)]/10 text-slate-300 hover:text-[var(--neon-cyan)] flex flex-col items-center justify-center gap-2 transition-all hover:scale-[1.02]">
                                    <span className="material-symbols-outlined text-2xl">restart_alt</span>
                                    <span className="text-sm font-bold">Reset Model</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 5. DEVELOPER */}
                    {activeTab === 'dev' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="mb-6">
                                <h3 className="text-lg font-bold text-white mb-1">Developer Console</h3>
                                <p className="text-xs text-slate-500">Debug tools.</p>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/10 mb-6 font-mono">
                                <div>
                                    <h4 className="text-sm font-bold text-[var(--neon-cyan)]">$ show_logs</h4>
                                    <p className="text-[10px] text-slate-500">Display persistent debug console.</p>
                                </div>
                                <button
                                    onClick={() => handleChange('showLogs', !settings.showLogs)}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${settings.showLogs ? 'bg-[var(--neon-cyan)]' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${settings.showLogs ? 'translate-x-6' : 'translate-x-0'}`}></div>
                                </button>
                            </div>

                            <div className="bg-black/40 rounded-xl p-6 border border-white/10 font-mono text-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Ollama Service</span>
                                    <span className="text-green-500 font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        Connected (Phi-3)
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Vosk Engine</span>
                                    <span className="text-green-500 font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        Ready
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Database</span>
                                    <span className="text-green-500 font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        Synced
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default SettingsModal;

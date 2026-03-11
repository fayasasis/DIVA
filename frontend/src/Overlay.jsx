import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Overlay = () => {
    const [prediction, setPrediction] = useState(null);

    useEffect(() => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            // Listen for new suggestions
            ipcRenderer.on('prediction', (event, data) => {
                setPrediction(data);
            });

            return () => {
                ipcRenderer.removeAllListeners('prediction');
            };
        }
    }, []);

    const handleAccept = async () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            // 1. Send feedback
            ipcRenderer.send('feedback', {
                type: 'accept',
                prediction: prediction
            });

            // 2. Execute Action via Backend
            try {
                await axios.post('http://localhost:5000/api/execute-prediction', { prediction });
                console.log("Executed:", prediction);
            } catch (e) {
                console.error("Execution Failed", e);
            }

            setPrediction(null);
            ipcRenderer.send('hide-overlay');
        }
    };

    const handleReject = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            // 1. Send negative feedback
            ipcRenderer.send('feedback', {
                type: 'reject',
                prediction: prediction
            });

            setPrediction(null);
            ipcRenderer.send('hide-overlay');
        }
    };

    useEffect(() => {
        let timer;
        if (prediction) {
            // Auto hide the suggestion after 8 seconds to prevent annoyance
            timer = setTimeout(() => {
                handleReject();
            }, 8000);
        }
        return () => clearTimeout(timer);
    }, [prediction]);

    if (!prediction) return null;

    return (
        <div className="flex items-center gap-3 p-3 bg-black/90 border border-[var(--neon-cyan)]/50 rounded-xl shadow-[0_0_20px_rgba(0,255,204,0.3)] backdrop-blur-md draggable select-none overflow-hidden">

            {/* Icon */}
            <div className="w-8 h-8 rounded-full bg-[var(--neon-cyan)]/10 flex items-center justify-center text-[var(--neon-cyan)]">
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>

            <div className="flex-1 min-w-0">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex justify-between">
                    <span>Suggestion</span>
                    <span className="text-[var(--neon-cyan)] opacity-70">{Math.round((prediction.confidence || 0) * 100)}%</span>
                </div>
                <div className="text-sm text-white font-medium truncate">
                    Open <span className="text-[var(--neon-cyan)] font-bold">{prediction.next_action || "App"}</span>?
                </div>
            </div>

            <div className="flex gap-2 no-drag">
                <button
                    onClick={handleAccept}
                    className="w-8 h-8 rounded-full bg-[var(--neon-cyan)]/20 hover:bg-[var(--neon-cyan)] text-[var(--neon-cyan)] hover:text-black flex items-center justify-center transition-all border border-[var(--neon-cyan)]/50"
                    title="Accept"
                >
                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                </button>
                <button
                    onClick={handleReject}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500/20 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all border border-white/20"
                    title="Ignore"
                >
                    <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <style>{`
        .draggable { -webkit-app-region: drag; }
        .no-drag { -webkit-app-region: no-drag; }
      `}</style>
        </div>
    );
};

export default Overlay;

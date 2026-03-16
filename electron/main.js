// ==============================
// ELECTRON MAIN PROCESS
// ==============================
// This file controls the "Desktop Shell" of the application.
// It manages the windows, spawns the backend services (Node/Python), 
// and handles Inter-Process Communication (IPC).

const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron'); // Electron Core Modules
const path = require('path');           // Path Utilities
const { spawn } = require('child_process'); // For spawning backend processes

// Global References to prevent garbage collection
let mainWindow;
let overlayWindow;
let pythonProcess;
let serverProcess;
let tray = null; // System Tray Icon

// Persisted App States
let appSettings = {
    alwaysOnTop: true,
    transparency: true,
    minimizeToTray: true,
    smartPredictions: true,
};

// --- CONFIGURATION ---
const IS_DEV = true; // Set to false for production builds
const FRONTEND_URL = 'http://localhost:5173'; // Vite Dev Server URL

/**
 * Creates the Primary Application Window.
 * This is the main chat interface where the user interacts with the AI.
 */
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,    // Enable Node.js Node API in Renderer (Less secure, but easier for local apps)
            contextIsolation: false,  // Disable Context Isolation to allow direct IPC access
        },
    });

    if (IS_DEV) {
        mainWindow.loadURL(FRONTEND_URL); // Load Vite Server
        // mainWindow.webContents.openDevTools(); // Optional: Open DevTools on start
    } else {
        // In production, load built index.html
        mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    }

    // --- MINIMIZE TO TRAY LOGIC ---
    mainWindow.on('close', (event) => {
        if (appSettings.minimizeToTray && !app.isQuitting) {
            event.preventDefault(); // Stop window from completely destroying itself
            mainWindow.hide(); // Hide instead of closing
            return false;
        }
    });

    // Dereference window object on close (if actually closing)
    mainWindow.on('closed', () => (mainWindow = null));
}

/**
 * Creates the Overlay Window (Mini-Widget).
 * This appears in the corner for quick notifications or prediction suggestions.
 */
function createOverlayWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: 350,
        height: 120,
        x: width - 370,      // Position: Bottom-Right (with padding)
        y: height - 150,
        frame: false,        // Frameless (no title bar)
        transparent: true,   // Transparent Background
        alwaysOnTop: true,   // Floating above other windows
        skipTaskbar: true,   // Don't show in taskbar
        focusable: false,    // Don't steal focus from user's current app
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        show: false // Start hidden
    });

    if (IS_DEV) {
        // Load specific route for the overlay widget
        overlayWindow.loadURL(`${FRONTEND_URL}/#/overlay`);
    }
}

// ==============================
// APP LIFECYCLE EVENTS
// ==============================

app.on('ready', () => {
    // 1. Create Windows
    createMainWindow();
    createOverlayWindow();

    // 1.5 Create System Tray
    try {
        // Attempt to create a simple tray icon (empty square or generic icon if path is wrong)
        const iconPath = path.join(__dirname, '../frontend/public/vite.svg');
        tray = new Tray(nativeImage.createFromPath(iconPath));
        
        const contextMenu = Menu.buildFromTemplate([
            { label: 'Open DIVA', click: () => mainWindow && mainWindow.show() },
            { type: 'separator' },
            { 
               label: 'Quit', 
               click: () => {
                   app.isQuitting = true;
                   app.quit();
               } 
            }
        ]);
        
        tray.setToolTip('DIVA Assistant');
        tray.setContextMenu(contextMenu);
        
        // Double click tray to open
        tray.on('double-click', () => {
            if (mainWindow) mainWindow.show();
        });
    } catch(e) {
        console.error("Failed to create Tray icon", e);
    }

    // 2. Start Python AI Service (The "Eyes and Ears")
    // Runs 'observer.py' to monitor windows
    pythonProcess = spawn('python', ['ai/observer.py'], { cwd: process.cwd() });

    // 3. Start Node.js Backend Server (The "Brain")
    // Runs 'server.js' to handle API/Database
    serverProcess = spawn('node', ['backend/server.js'], { cwd: process.cwd() });

    // --- LOGGING TO FRONTEND ---
    const sendLog = (type, message) => {
        if (mainWindow && !mainWindow.isDestroyed() && appSettings.showLogs) {
            mainWindow.webContents.send('backend-log', { type, message, time: new Date().toISOString() });
        }
    };

    // --- BACKEND LOGS ---
    // Pipe backend logs to Electron console and Frontend UI
    serverProcess.stdout.on('data', (data) => {
        const text = data.toString().trim();
        console.log(`[Backend] ${text}`);
        if (text) sendLog('node', text);
    });
    serverProcess.stderr.on('data', (data) => {
        const text = data.toString().trim();
        console.error(`[Backend Err] ${text}`);
        if (text) sendLog('node-error', text);
    });

    // --- PYTHON PREDICTION HANDLING ---
    // When Python prints something, we check if it's a prediction JSON.
    let buffer = '';
    pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the incomplete line for next chunk

        lines.forEach(line => {
            const str = line.trim();
            if (!str) return;

            console.log(`[Python] ${str}`); // Log all Python output
            sendLog('python', str);

            // Detect Prediction Payload
            // Format from observer.py: "JSON_PREDICTION: { ... }"
            if (str.includes('JSON_PREDICTION:')) {
                try {
                    const jsonStr = str.split('JSON_PREDICTION:')[1].trim();
                    const prediction = JSON.parse(jsonStr);

                    console.log("[Main] Routing Prediction:", prediction); // DEBUG

                    // INTELLIGENCE SETTING CHECK:
                    if (!appSettings.smartPredictions) {
                        console.log("[Main] Smart Predictions disabled. Skipping.");
                        if (overlayWindow) overlayWindow.hide();
                        return;
                    }

                    // ROUTING INTELLIGENCE:
                    // If Main Window is focused, show prediction there (inline).
                    // If User is in another app, show the Overlay Widget.
                    if (mainWindow && mainWindow.isFocused()) {
                        console.log("[Main] Sending to Main Window");
                        mainWindow.webContents.send('prediction', prediction);
                        if (overlayWindow) overlayWindow.hide();
                    } else if (overlayWindow) {
                        console.log("[Main] Sending to Overlay");
                        overlayWindow.show();
                        overlayWindow.webContents.send('prediction', prediction);
                    }
                } catch (e) {
                    console.error('Failed to parse Python prediction:', e);
                }
            }
        });
    });

    pythonProcess.stderr.on('data', (data) => {
        const text = data.toString().trim();
        console.error(`[Python stderr] ${text}`);
        if (text) sendLog('python-error', text);
    });
});

// Quit when all windows are closed (except on Mac)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Cleanup processes on quit
app.on('will-quit', () => {
    if (pythonProcess) pythonProcess.kill();
    if (serverProcess) serverProcess.kill();
});

// ==============================
// IPC HANDLERS (Inter-Process Communication)
// ==============================
// Listen for messages from Renderer (Frontend)

ipcMain.on('show-overlay', () => { if (overlayWindow) overlayWindow.show(); });
ipcMain.on('hide-overlay', () => { if (overlayWindow) overlayWindow.hide(); });

ipcMain.on('feedback', (event, data) => {
    console.log('[Feedback]', data);
    // Placeholder: Future Reinforcement Learning hook
});

// SETTINGS LISTENER FROM REACT
ipcMain.on('update-settings', (event, newSettings) => {

    if (mainWindow) {
        // Handle Window Mode (Resize)
        if (newSettings.windowMode && newSettings.windowMode !== appSettings.windowMode) {
             if (newSettings.windowMode === 'widget') {
                 mainWindow.setSize(400, 700, true); // Shrink to mobile/widget size
             } else {
                 mainWindow.setSize(1200, 800, true); // Expand to normal desktop size
             }
             mainWindow.center(); // Re-center on screen after resize
        }
    
        // Apply Always On Top
        const updatedAlwaysOnTop = newSettings.alwaysOnTop !== undefined ? newSettings.alwaysOnTop : appSettings.alwaysOnTop;
        mainWindow.setAlwaysOnTop(updatedAlwaysOnTop);
    }
    
    // Merge new settings into persistent state AFTER checking for changes (like window mode above)
    appSettings = { ...appSettings, ...newSettings };
    console.log("[Main] Settings Updated from Frontend:", appSettings);
});

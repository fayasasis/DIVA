// ==============================
// ELECTRON MAIN PROCESS
// ==============================
// This file controls the "Desktop Shell" of the application.
// It manages the windows, spawns the backend services (Node/Python), 
// and handles Inter-Process Communication (IPC).

const { app, BrowserWindow, screen, ipcMain } = require('electron'); // Electron Core Modules
const path = require('path');           // Path Utilities
const { spawn } = require('child_process'); // For spawning backend processes

// Global References to prevent garbage collection
let mainWindow;
let overlayWindow;
let pythonProcess;
let serverProcess;

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

    // Dereference window object on close
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

    // 2. Start Python AI Service (The "Eyes and Ears")
    // Runs 'observer.py' to monitor windows
    pythonProcess = spawn('python', ['ai/observer.py'], { cwd: process.cwd() });

    // 3. Start Node.js Backend Server (The "Brain")
    // Runs 'server.js' to handle API/Database
    serverProcess = spawn('node', ['backend/server.js'], { cwd: process.cwd() });

    // --- LOGGING ---
    // Pipe backend logs to Electron console for easy debugging
    serverProcess.stdout.on('data', (data) => console.log(`[Backend] ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`[Backend Err] ${data}`));

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

            // Detect Prediction Payload
            // Format from observer.py: "JSON_PREDICTION: { ... }"
            if (str.includes('JSON_PREDICTION:')) {
                try {
                    const jsonStr = str.split('JSON_PREDICTION:')[1].trim();
                    const prediction = JSON.parse(jsonStr);

                    console.log("[Main] Routing Prediction:", prediction); // DEBUG

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

    pythonProcess.stderr.on('data', (data) => console.error(`[Python stderr] ${data}`));
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

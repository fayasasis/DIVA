const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let overlayWindow;
let pythonProcess;
let serverProcess;

// --- CONFIG ---
const IS_DEV = true;
const FRONTEND_URL = 'http://localhost:5173';

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    if (IS_DEV) {
        mainWindow.loadURL(FRONTEND_URL);
    }

    mainWindow.on('closed', () => (mainWindow = null));
}

function createOverlayWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    overlayWindow = new BrowserWindow({
        width: 350,
        height: 120,
        x: width - 370, // Bottom-Right corner
        y: height - 150,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        focusable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        show: false
    });

    if (IS_DEV) {
        overlayWindow.loadURL(`${FRONTEND_URL}/#/overlay`);
    }
}

app.on('ready', () => {
    createMainWindow();
    createOverlayWindow();

    // 1. Start Python Observer
    pythonProcess = spawn('python', ['ai/observer.py'], { cwd: process.cwd() });

    // 2. Start Request/Response Backend
    serverProcess = spawn('node', ['backend/server.js'], { cwd: process.cwd() });

    serverProcess.stdout.on('data', (data) => console.log(`[Backend] ${data}`));
    serverProcess.stderr.on('data', (data) => console.error(`[Backend Err] ${data}`));

    let buffer = '';
    pythonProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the incomplete line in buffer

        lines.forEach(line => {
            const str = line.trim();
            if (!str) return;

            console.log(`[Python] ${str}`);

            // Parse JSON predictions
            if (str.includes('JSON_PREDICTION:')) {
                try {
                    const jsonStr = str.split('JSON_PREDICTION:')[1].trim();
                    const prediction = JSON.parse(jsonStr);

                    console.log("[Main] Routing Prediction:", prediction); // DEBUG

                    // ROUTING LOGIC
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

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (pythonProcess) pythonProcess.kill();
    if (serverProcess) serverProcess.kill();
});

// IPC Handlers
// IPC Handlers
ipcMain.on('show-overlay', () => { if (overlayWindow) overlayWindow.show(); });
ipcMain.on('hide-overlay', () => { if (overlayWindow) overlayWindow.hide(); });

ipcMain.on('feedback', (event, data) => {
    console.log('[Feedback]', data);
    // Future: Send to Python via stdin or HTTP for reinforcement learning
    // For now, we trust natural learning (if user accepted, they open the app, Observer sees it)
});

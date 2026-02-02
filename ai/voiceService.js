// ==============================
// DIVA VOICE INPUT SERVICE (EARS)
// ==============================
// This file connects Node.js (backend) with Python (voice recognition).
//
// WHY PYTHON?
// - Python has better, stable libraries for speech recognition (Vosk).
// - Node.js talks to Python instead of handling audio directly.
//
// ROLE OF THIS FILE:
// - Start listening to microphone
// - Receive recognized text from Python
// - Send recognized text back to backend logic
// ==============================


// ------------------------------
// IMPORT REQUIRED MODULES
// ------------------------------

// child_process.spawn lets Node.js run another program (Python)
const { spawn } = require('child_process');

// path helps build correct file paths (Windows/Linux safe)
const path = require('path');


// ------------------------------
// GLOBAL VARIABLE
// ------------------------------
// Holds the running Python process.
// If this is NOT null → microphone is already active.
let pythonProcess = null;


// ------------------------------
// START LISTENING FUNCTION
// ------------------------------
// This function:
// 1. Starts the Python speech-recognition script
// 2. Listens to its output
// 3. Sends recognized speech back using a callback
//
// callback(text) → called whenever speech is recognized

function startListening(callback) {

    // Prevent starting multiple microphone listeners
    if (pythonProcess) return;


    // ==============================
    // STEP 1: LOCATE PYTHON SCRIPT
    // ==============================
    // ears.py is the Python file that:
    // - Listens to microphone
    // - Uses Vosk
    // - Prints recognized text

    const scriptPath = path.join(__dirname, 'ears.py');


    // ==============================
    // STEP 2: SPAWN PYTHON PROCESS
    // ==============================
    // '-u' → unbuffered output (important for real-time voice)
    // cwd → run Python inside this folder

    console.log("🎧 Spawning Python Ears...");
    
    pythonProcess = spawn(
        'python',                // Command to run
        ['-u', scriptPath],      // Arguments
        { cwd: __dirname }       // Working directory
    );


    // ==============================
    // STEP 3: LISTEN TO PYTHON OUTPUT
    // ==============================
    // Python prints text to stdout.
    // Node.js receives it here.

    pythonProcess.stdout.on('data', (data) => {

        // Convert raw buffer → readable string
        const output = data.toString();


        // We look for a special marker printed by Python
        // Example: "RECOGNIZED: open notepad"
        if (output.includes('RECOGNIZED:')) {

            // Extract only the spoken text
            const text = output
                .split('RECOGNIZED:')[1]
                .trim();

            // Ignore empty speech
            if (text.length > 0) {
                console.log(`🗣️ Heard via Python: "${text}"`);

                // Send text back to backend (server.js)
                callback(text);
            }

        } else {
            // Normal Python logs (status messages)
            console.log(`[Python Log]: ${output.trim()}`);
        }
    });


    // ==============================
    // STEP 4: HANDLE PYTHON ERRORS
    // ==============================
    // If Python crashes or throws errors,
    // we log them here.

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python Error]: ${data}`);
    });


    // ==============================
    // STEP 5: CLEANUP WHEN CLOSED
    // ==============================
    // Runs when Python process stops.

    pythonProcess.on('close', (code) => {
        console.log(`🎧 Python Ears closed (Code ${code})`);
        pythonProcess = null;
    });
}


// ------------------------------
// STOP LISTENING FUNCTION
// ------------------------------
// This completely shuts down the Python process.
// Used when user clicks "Stop Mic".

function stopListening() {
    if (pythonProcess) {
        console.log("🛑 Killing Python Ears...");
        pythonProcess.kill();   // Force stop Python
        pythonProcess = null;
    }
}


// ------------------------------
// EXPORT FUNCTIONS
// ------------------------------
// Allows server.js to control the microphone
module.exports = {
    startListening,
    stopListening
};

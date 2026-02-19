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
// Holds the running Python process instance.
// If this is NOT null → it means the microphone is currently active.
let pythonProcess = null;


// ------------------------------
// START LISTENING FUNCTION
// ------------------------------
// This function:
// 1. Starts the Python speech-recognition script (ears.py)
// 2. Listens to its standard output (stdout)
// 3. Sends recognized speech back using a callback function
//
// @param {function} callback - Function to call when text is recognized (callback(text))
function startListening(callback) {

    // Prevent starting multiple microphone listeners at the same time
    if (pythonProcess) return;


    // ==============================
    // STEP 1: LOCATE PYTHON SCRIPT
    // ==============================
    // ears.py is the Python file that:
    // - Listens to microphone input using PyAudio
    // - Uses Vosk model to transcribe audio
    // - Prints recognized text to the console
    const scriptPath = path.join(__dirname, 'ears.py');


    // ==============================
    // STEP 2: SPAWN PYTHON PROCESS
    // ==============================
    // We run the python command with the script path.
    // '-u' flag means unbuffered output (important for real-time voice streaming)
    // cwd sets the current working directory to this file's folder

    console.log("Spawning Python Ears...");

    pythonProcess = spawn(
        'python',                // Command to run Python
        ['-u', scriptPath],      // Arguments: unbuffered mode + script file
        { cwd: __dirname }       // Working directory: e:\DIVA\ai
    );


    // ==============================
    // STEP 3: LISTEN TO PYTHON OUTPUT
    // ==============================
    // Python prints text to stdout (standard output).
    // Node.js receives it here via the 'data' event.

    pythonProcess.stdout.on('data', (data) => {

        // Convert the raw binary buffer → readable string
        const output = data.toString();


        // We look for a special marker printed by our Python script
        // Example output from Python: "RECOGNIZED: open notepad"
        if (output.includes('RECOGNIZED:')) {

            // Extract only the spoken text part
            // Split by the marker and take the second part (index 1)
            const text = output
                .split('RECOGNIZED:')[1]
                .trim(); // Remove leading/trailing whitespace

            // Ignore empty speech or noise
            if (text.length > 0) {
                console.log(`Heard via Python: "${text}"`);

                // Send the text back to backend (server.js) via the callback
                callback(text);
            }

        } else {
            // If it's not a recognized text, it's likely a log message from Python
            console.log(`[Python Log]: ${output.trim()}`);
        }
    });


    // ==============================
    // STEP 4: HANDLE PYTHON ERRORS
    // ==============================
    // If Python crashes or throws errors to stderr (standard error),
    // we capture and log them here for debugging.

    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python Error]: ${data}`);
    });


    // ==============================
    // STEP 5: CLEANUP WHEN CLOSED
    // ==============================
    // This event runs when the Python process stops or exits.

    pythonProcess.on('close', (code) => {
        console.log(`Python Ears closed (Code ${code})`);
        pythonProcess = null; // Reset the variable so we can start again later
    });
}


// ------------------------------
// STOP LISTENING FUNCTION
// ------------------------------
// This completely shuts down the Python process.
// Used when the user clicks "Stop Mic" in the frontend.

function stopListening() {
    if (pythonProcess) {
        console.log("Killing Python Ears...");
        pythonProcess.kill();   // Forcefully stop the Python process
        pythonProcess = null;   // Clear the reference
    }
}


// ------------------------------
// EXPORT FUNCTIONS
// ------------------------------
// Allows other files (like server.js) to import and use these functions.
module.exports = {
    startListening,
    stopListening
};

const { spawn } = require('child_process');
const path = require('path');

let pythonProcess = null;

function startListening(callback) {
    if (pythonProcess) return; // Already listening

    // 1. Path to our Python Script
    const scriptPath = path.join(__dirname, 'ears.py');
    
    // 2. Spawn Python
    // We use 'python' command. If your system uses 'python3', change it below.
    console.log("🎧 Spawning Python Ears...");
    pythonProcess = spawn('python', ['-u', scriptPath], { cwd: __dirname });

    // 3. Listen to Python's Output (Stdout)
    pythonProcess.stdout.on('data', (data) => {
        const output = data.toString();
        
        // Check for our special tag
        if (output.includes('RECOGNIZED:')) {
            const text = output.split('RECOGNIZED:')[1].trim();
            if (text.length > 0) {
                console.log(`🗣️ Heard via Python: "${text}"`);
                callback(text);
            }
        } else {
            // Just a log message from Python
            console.log(`[Python Log]: ${output.trim()}`);
        }
    });

    // 4. Handle Errors
    pythonProcess.stderr.on('data', (data) => {
        console.error(`[Python Error]: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`🎧 Python Ears closed (Code ${code})`);
        pythonProcess = null;
    });
}

function stopListening() {
    if (pythonProcess) {
        console.log("🛑 Killing Python Ears...");
        pythonProcess.kill(); // This completely shuts down the Python script
        pythonProcess = null;
    }
}

module.exports = { startListening, stopListening };
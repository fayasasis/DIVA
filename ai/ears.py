# ==============================
# DIVA VOICE INPUT (PYTHON EARS)
# ==============================
# This Python script listens to the microphone,
# converts speech to text using Vosk,
# and sends recognized text back to Node.js.
#
# IMPORTANT:
# - This script DOES NOT make decisions
# - It ONLY converts voice → text
# - Node.js reads the output of this script
# ==============================


# ------------------------------
# IMPORT REQUIRED MODULES
# ------------------------------

import sys          # Used for system-level operations (exit, stderr, stdout flushing)
import json         # Used to read Vosk results (which returns JSON format)
import sounddevice as sd  # Library to capture raw microphone audio
import queue        # Thread-safe queue to buffer audio data between callback and main loop
from vosk import Model, KaldiRecognizer  # Offline speech recognition library


# ------------------------------
# 1. LOAD VOSK MODEL
# ------------------------------
# The speech recognition model must exist locally to work offline.
# We assume the model folder is named "model"
# and placed inside the same directory as this file.

MODEL_PATH = "model" # Path to the downloaded Vosk model directory

try:
    print("PYTHON: Loading Vosk Model...", flush=True) # Notify Node.js that loading started
    
    # Load the offline speech model into memory.
    # This might take a few seconds depending on disk speed.
    model = Model(MODEL_PATH)
    
    print("PYTHON: Model Loaded! Ears Open.", flush=True) # Notify success

except Exception as e:
    # If model loading fails (e.g. folder missing), stop everything.
    print(
        f"PYTHON: Error loading model. "
        f"Is the 'model' folder in the right place? {e}",
        flush=True
    )
    sys.exit(1)  # Exit Python immediately with error code 1


# ------------------------------
# 2. MICROPHONE AUDIO BUFFER
# ------------------------------
# We use a queue to safely pass audio data
# from the microphone callback (which runs in a separate thread)
# to the main loop (which runs in the main thread).

q = queue.Queue()


def callback(indata, frames, time, status):
    """
    This function is automatically called by sounddevice
    every time a new chunk of microphone audio is available.
    
    Parameters:
    - indata  : raw audio bytes array
    - frames  : number of samples in this chunk
    - time    : timing information (unused here)
    - status  : errors or warnings (e.g., input overflow)
    """

    # Print microphone warnings if any (e.g. buffer overflow)
    if status:
        print(status, file=sys.stderr)

    # Push raw audio data into the queue for processing
    # We convert it to bytes to ensure compatibility with Vosk
    q.put(bytes(indata))


# ------------------------------
# 3. MAIN LISTENING LOOP
# ------------------------------
# Vosk expects specific audio settings:
# - Sample Rate: 16000 Hz (Standard for speech models)
# - Mono channel (1 channel)
# - int16 audio format (16-bit PCM)

try:
    # Open the microphone input stream
    with sd.RawInputStream(
        samplerate=16000,   # Standard Vosk sample rate
        blocksize=8000,     # Audio chunk size (0.5 seconds of audio)
        dtype='int16',      # Audio format (16-bit integer)
        channels=1,         # Mono microphone
        callback=callback   # Function called for each chunk
    ):

        # Create the speech recognizer object using the loaded model
        rec = KaldiRecognizer(model, 16000)

        # Infinite loop: always listening until stopped
        while True:
            # Wait for next chunk of audio from the queue
            data = q.get()

            # Feed audio to Vosk. 
            # AcceptWaveform returns True if a full sentence/phrase is detected.
            # It returns False if it's still listening to a sentence.
            if rec.AcceptWaveform(data):

                # Get final recognition result as JSON string
                result = json.loads(rec.Result())

                # Extract recognized text from JSON
                text = result.get('text', '')

                # Verify text is not empty
                if text:
                    # VERY IMPORTANT:
                    # We print recognized speech to stdout.
                    # Node.js reads this output via its child_process.stdout listener.
                    #
                    # "RECOGNIZED:" is a special marker string
                    # so Node.js knows this line contains actual speech commands.
                    print(f"RECOGNIZED:{text}", flush=True)

            else:
                # Partial speech detected (e.g., "Open...", "Open Note...").
                # We ignore partial results for now and wait for the full sentence.
                pass


# ------------------------------
# GRACEFUL SHUTDOWN
# ------------------------------

except KeyboardInterrupt:
    # Triggered when Node.js kills the process (CTRL+C or SIGINT)
    print("\nPYTHON: Stopping ears.", flush=True)

except Exception as e:
    # Any unexpected error (e.g., microphone disconnected)
    print(f"\nPYTHON: Error: {e}", flush=True)

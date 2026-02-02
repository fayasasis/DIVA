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

import sys          # Used for system-level operations (exit, stderr)
import json         # Used to read Vosk results (JSON format)
import sounddevice as sd  # Captures microphone audio
import queue        # Thread-safe audio buffering
from vosk import Model, KaldiRecognizer  # Offline speech recognition


# ------------------------------
# 1. LOAD VOSK MODEL
# ------------------------------
# The speech recognition model must exist locally.
# We assume the model folder is named "model"
# and placed inside the same directory as this file.

MODEL_PATH = "model"

try:
    print("PYTHON: Loading Vosk Model...", flush=True)
    
    # Load the offline speech model into memory
    model = Model(MODEL_PATH)
    
    print("PYTHON: Model Loaded! Ears Open.", flush=True)

except Exception as e:
    # If model loading fails, stop everything
    print(
        f"PYTHON: Error loading model. "
        f"Is the 'model' folder in the right place? {e}",
        flush=True
    )
    sys.exit(1)  # Exit Python immediately


# ------------------------------
# 2. MICROPHONE AUDIO BUFFER
# ------------------------------
# We use a queue to safely pass audio data
# from the microphone callback to the main loop.

q = queue.Queue()


def callback(indata, frames, time, status):
    """
    This function is automatically called by sounddevice
    every time a new chunk of microphone audio is available.
    
    Parameters:
    - indata  : raw audio bytes
    - frames  : number of frames
    - time    : timing information
    - status  : errors or warnings
    """

    # Print microphone warnings if any
    if status:
        print(status, file=sys.stderr)

    # Push raw audio data into the queue
    q.put(bytes(indata))


# ------------------------------
# 3. MAIN LISTENING LOOP
# ------------------------------
# Vosk expects:
# - Sample Rate: 16000 Hz
# - Mono channel
# - int16 audio format

try:
    with sd.RawInputStream(
        samplerate=16000,   # Standard Vosk sample rate
        blocksize=8000,     # Audio chunk size
        dtype='int16',      # Audio format
        channels=1,         # Mono microphone
        callback=callback   # Function called for each chunk
    ):

        # Create the speech recognizer
        rec = KaldiRecognizer(model, 16000)

        # Infinite loop: always listening
        while True:
            # Wait for next chunk of audio
            data = q.get()

            # Check if Vosk recognizes a full sentence
            if rec.AcceptWaveform(data):

                # Get recognition result as JSON
                result = json.loads(rec.Result())

                # Extract recognized text
                text = result.get('text', '')

                if text:
                    # VERY IMPORTANT:
                    # We print recognized speech to stdout.
                    # Node.js reads this output.
                    #
                    # "RECOGNIZED:" is a special marker
                    # so Node.js knows this line contains speech.
                    print(f"RECOGNIZED:{text}", flush=True)

            else:
                # Partial speech detected (ignored)
                pass


# ------------------------------
# GRACEFUL SHUTDOWN
# ------------------------------

except KeyboardInterrupt:
    # Triggered when Node.js kills the process
    print("\nPYTHON: Stopping ears.", flush=True)

except Exception as e:
    # Any unexpected error
    print(f"\nPYTHON: Error: {e}", flush=True)

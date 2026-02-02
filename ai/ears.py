import sys
import json
import sounddevice as sd
import queue
from vosk import Model, KaldiRecognizer

# 1. SETUP
# We assume the model is in the 'model' folder inside 'ai'
MODEL_PATH = "model" 

try:
    print("PYTHON: Loading Vosk Model...", flush=True)
    model = Model(MODEL_PATH)
    print("PYTHON: Model Loaded! Ears Open.", flush=True)
except Exception as e:
    print(f"PYTHON: Error loading model. Is the 'model' folder in the right place? {e}", flush=True)
    sys.exit(1)

# 2. MICROPHONE SETUP
q = queue.Queue()

def callback(indata, frames, time, status):
    """This is called for every chunk of audio"""
    if status:
        print(status, file=sys.stderr)
    q.put(bytes(indata))

# 3. LISTENING LOOP
# Sample rate 16000 is standard for Vosk
try:
    with sd.RawInputStream(samplerate=16000, blocksize=8000, dtype='int16',
                           channels=1, callback=callback):
        
        rec = KaldiRecognizer(model, 16000)
        
        while True:
            data = q.get()
            if rec.AcceptWaveform(data):
                # We found a complete sentence
                result = json.loads(rec.Result())
                text = result.get('text', '')
                
                if text:
                    # Print it so Node.js can read it
                    # We add a prefix "RECOGNIZED:" to make it easy to parse
                    print(f"RECOGNIZED:{text}", flush=True)
                    
            else:
                # Still processing partial phrases...
                pass

except KeyboardInterrupt:
    print("\nPYTHON: Stopping ears.", flush=True)
except Exception as e:
    print(f"\nPYTHON: Error: {e}", flush=True)
WebSynth v0.4 — WAV export added

Run: python -m http.server 8000
Open: http://localhost:8000

Create or import notes, click Export WAV. Downloads WebSynth-<bpm>bpm.wav.
Exports the full configured measure length plus the release tail as 44.1kHz stereo 16-bit PCM WAV.
Uses the current oscillator, filter, ADSR, volume, note positions and BPM.
The preset buttons and your existing HTML/CSS remain intact.

Limitations: exporter renders the current pattern once (not repeated loops), and fixed-length notes on the 1/16 grid.

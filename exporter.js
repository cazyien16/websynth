// Offline renderer and 16-bit PCM WAV encoder for WebSynth.
// Uses the same oscillator -> low-pass -> ADSR -> master chain as synth.js.
import { midiToHz } from './synth.js';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export async function renderPatternToWav({ notes, bpm, totalSteps, patch }) {
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isInteger(totalSteps) || totalSteps < 1) {
    throw new Error('Invalid pattern length or tempo.');
  }
  const sampleRate = 44100;
  const secondsPerStep = 60 / bpm / 4;
  const patternSeconds = totalSteps * secondsPerStep;
  const tail = Math.max(0.1, Number(patch.release) + 0.04);
  const duration = patternSeconds + tail;
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContext) throw new Error('Offline audio rendering is not available in this browser.');
  const context = new OfflineContext(2, Math.ceil(duration * sampleRate), sampleRate);
  const master = context.createGain();
  master.gain.value = clamp(Number(patch.volume), 0, 1) * 0.3;
  master.connect(context.destination);

  for (const note of notes) {
    if (!Number.isFinite(note.pitch) || !Number.isFinite(note.step) || !Number.isFinite(note.length)) continue;
    if (note.step < 0 || note.step >= totalSteps || note.length <= 0) continue;
    const start = note.step * secondsPerStep;
    const held = Math.max(0.025, Math.min(note.length, totalSteps - note.step) * secondsPerStep);
    const end = start + held;
    const a = Math.max(0.005, Number(patch.attack));
    const d = Math.max(0.005, Number(patch.decay));
    const s = clamp(Number(patch.sustain), 0, 1);
    const r = Math.max(0.01, Number(patch.release));
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const amp = context.createGain();
    oscillator.type = ['sine', 'triangle', 'sawtooth', 'square'].includes(patch.waveform) ? patch.waveform : 'sawtooth';
    oscillator.frequency.setValueAtTime(midiToHz(note.pitch), start);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(clamp(Number(patch.cutoff), 40, sampleRate * 0.45), start);
    filter.Q.setValueAtTime(clamp(Number(patch.resonance), 0.1, 15), start);
    amp.gain.setValueAtTime(0, start);
    // Attack and decay match live playback. If note-off happens mid-envelope,
    // override future automation and release from the instantaneous envelope level.
    if (end <= start + a) {
      amp.gain.linearRampToValueAtTime(held / a, end);
    } else {
      amp.gain.linearRampToValueAtTime(1, start + a);
      if (end < start + a + d) {
        amp.gain.linearRampToValueAtTime(1 + (s - 1) * ((held - a) / d), end);
      } else {
        amp.gain.linearRampToValueAtTime(s, start + a + d);
      }
    }
    // Ramp to silence after note-off, preserving partial-attack/decay behavior.
    amp.gain.linearRampToValueAtTime(0, end + r);
    oscillator.connect(filter);
    filter.connect(amp);
    amp.connect(master);
    oscillator.start(start);
    oscillator.stop(end + r + 0.025);
  }

  const audioBuffer = await context.startRendering();
  return encodeWav(audioBuffer);
}

export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const bytesPerFrame = channels * bytesPerSample;
  const output = new ArrayBuffer(44 + frames * bytesPerFrame);
  const view = new DataView(output);
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  }
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frames * bytesPerFrame, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format chunk length
  view.setUint16(20, 1, true);  // Linear PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, frames * bytesPerFrame, true);
  const sampleData = Array.from({ length: channels }, (_, ch) => buffer.getChannelData(ch));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let ch = 0; ch < channels; ch++) {
      const sample = clamp(sampleData[ch][i], -1, 1);
      view.setInt16(offset, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
      offset += 2;
    }
  }
  return new Blob([output], { type: 'audio/wav' });
}

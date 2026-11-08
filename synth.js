// SPECTRA v0.3 — one oscillator per voice, shared settings for live and scheduled notes.
export const defaultPatch = {
  waveform: 'sawtooth', attack: 0.015, decay: 0.2, sustain: 0.65,
  release: 0.22, cutoff: 8000, resonance: 0.7, volume: 0.35
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const midiToHz = n => 440 * 2 ** ((n - 69) / 12);
export class SpectraSynth {
  constructor() {
    this.patch = { ...defaultPatch };
    this.context = null;
    this.master = null;
    this.live = new Map();
    this.allVoices = new Set();
  }
  async init() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio is not supported in this browser.');
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.patch.volume * 0.3;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  setParameter(key, value) {
    if (key === 'waveform') {
      if (!['sine', 'triangle', 'sawtooth', 'square'].includes(value)) return;
      this.patch.waveform = value;
      for (const voice of this.allVoices) voice.osc.type = value;
      return;
    }
    const ranges = { attack:[0.005,2], decay:[0.005,2], sustain:[0,1], release:[0.01,3], cutoff:[40,16000], resonance:[0.1,15], volume:[0,1] };
    if (!ranges[key] || !Number.isFinite(Number(value))) return;
    value = clamp(Number(value), ...ranges[key]);
    this.patch[key] = value;
    if (!this.context) return;
    const now = this.context.currentTime;
    if (key === 'volume') this.master.gain.setTargetAtTime(value * 0.3, now, 0.015);
    for (const voice of this.allVoices) {
      if (key === 'cutoff') voice.filter.frequency.setTargetAtTime(Math.min(value,this.context.sampleRate*.45), now, .015);
      if (key === 'resonance') voice.filter.Q.setTargetAtTime(value, now, .015);
    }
  }
  createVoice(note, startAt) {
    const ctx = this.context, p = { ...this.patch };
    const t = Math.max(startAt, ctx.currentTime);
    const osc = ctx.createOscillator(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    osc.type = p.waveform;
    osc.frequency.setValueAtTime(midiToHz(note), t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(p.cutoff,ctx.sampleRate*.45), t);
    filter.Q.setValueAtTime(p.resonance, t);
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(1, t + p.attack);
    amp.gain.linearRampToValueAtTime(p.sustain, t + p.attack + p.decay);
    osc.connect(filter); filter.connect(amp); amp.connect(this.master);
    const voice = { osc, filter, amp, t, p, finished:false };
    this.allVoices.add(voice);
    osc.onended = () => {
      voice.finished = true;
      this.allVoices.delete(voice);
      if (this.live.get(note) === voice) this.live.delete(note);
      osc.disconnect(); filter.disconnect(); amp.disconnect();
    };
    osc.start(t);
    return voice;
  }
  releaseVoice(voice, when = this.context.currentTime, release = this.patch.release) {
    if (!voice || voice.finished || voice.releasing) return;
    voice.releasing = true;
    const t = Math.max(when, voice.t, this.context.currentTime);
    const { attack, decay, sustain } = voice.p;
    const elapsed = t - voice.t;
    let level = sustain;
    if (elapsed < attack) level = elapsed / attack;
    else if (elapsed < attack + decay) level = 1 + (sustain-1)*(elapsed-attack)/decay;
    const gain = voice.amp.gain;
    gain.cancelScheduledValues(t);
    gain.setValueAtTime(clamp(level,0,1),t);
    gain.linearRampToValueAtTime(0, t + release);
    voice.osc.stop(t + release + .025);
  }
  async noteOn(note) {
    await this.init();
    if (this.live.has(note)) return;
    if (this.allVoices.size >= 32) return;
    this.live.set(note,this.createVoice(note,this.context.currentTime));
  }
  noteOff(note) {
    const voice = this.live.get(note);
    if (voice) { this.live.delete(note); this.releaseVoice(voice); }
  }
  scheduleNote(note, at, durationSeconds) {
    if (!this.context || this.allVoices.size >= 80) return;
    const voice = this.createVoice(note, at);
    this.releaseVoice(voice, at + Math.max(.025, durationSeconds));
  }
  stopAll() {
    if (!this.context) return;
    this.live.clear();
    const now = this.context.currentTime;
    for (const voice of [...this.allVoices]) {
      if (voice.finished) continue;
      // Cancel all future automation; bring each voice down quickly.
      const g = voice.amp.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(0, g.value), now);
      g.linearRampToValueAtTime(0, now + .015);
      try { voice.osc.stop(now + .025); } catch (_) { /* scheduled stop may already exist */ }
      voice.releasing = true;
    }
  }
}

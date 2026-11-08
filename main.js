import { SpectraSynth } from './synth.js';

const synth = new SpectraSynth();
const status = document.getElementById('statusText');
const keyboard = document.getElementById('keyboard');
const cutoffFromSlider = (v) => 80 * Math.pow(16000 / 80, Number(v) / 100);

const controls = [
  ['attack', 'attack', v => `${v.toFixed(2)} s`],
  ['decay', 'decay', v => `${v.toFixed(2)} s`],
  ['sustain', 'sustain', v => `${Math.round(v * 100)}%`],
  ['release', 'release', v => `${v.toFixed(2)} s`],
  ['cutoff', 'cutoff', v => `${Math.round(v).toLocaleString()} Hz`, cutoffFromSlider],
  ['resonance', 'resonance', v => v.toFixed(1)],
  ['volume', 'volume', v => `${Math.round(v * 100)}%`],
];

for (const [id, parameter, format, convert] of controls) {
  const slider = document.getElementById(id);
  const output = document.getElementById(`${id}Value`);
  const update = () => {
    const value = convert ? convert(slider.value) : Number(slider.value);
    synth.setParameter(parameter, value);
    output.textContent = format(value);
  };
  slider.addEventListener('input', update);
  update();
}

// Build oscillator rows dynamically so the synth engine and UI share the same indexing.
const waveNames = [
  ['sine', 'Sine'], ['triangle', 'Triangle'],
  ['sawtooth', 'Saw'], ['square', 'Square'],
];
const oscContainer = document.getElementById('oscillatorControls');
for (let index = 0; index < synth.patch.oscillators.length; index++) {
  const initial = synth.patch.oscillators[index];
  const row = document.createElement('div');
  row.className = 'osc-row';
  row.innerHTML = `
    <div class="osc-head"><span class="osc-number">OSC ${index + 1}</span><span class="osc-label">${index === 0 ? 'PRIMARY' : 'LAYER'}</span></div>
    <div class="wave-picker compact" role="group" aria-label="Oscillator ${index + 1} waveform">
      ${waveNames.map(([value, label]) => `<button type="button" class="wave ${initial.waveform === value ? 'active' : ''}" data-wave="${value}" aria-pressed="${initial.waveform === value}">${label}</button>`).join('')}
    </div>
    <div class="osc-knobs">
      <label>Octave <select class="octave" aria-label="Oscillator ${index + 1} octave">
        ${[-2,-1,0,1,2].map(n => `<option value="${n}" ${initial.octave === n ? 'selected' : ''}>${n > 0 ? '+' : ''}${n}</option>`).join('')}
      </select></label>
      <label>Fine <output class="detune-value">${initial.detune > 0 ? '+' : ''}${initial.detune}¢</output>
        <input class="detune" type="range" min="-100" max="100" step="1" value="${initial.detune}" aria-label="Oscillator ${index + 1} fine tune">
      </label>
      <label>Level <output class="level-value">${Math.round(initial.level * 100)}%</output>
        <input class="level" type="range" min="0" max="100" step="1" value="${Math.round(initial.level * 100)}" aria-label="Oscillator ${index + 1} level">
      </label>
    </div>`;
  oscContainer.appendChild(row);
  for (const button of row.querySelectorAll('[data-wave]')) {
    button.addEventListener('click', () => {
      synth.setOscillatorParameter(index, 'waveform', button.dataset.wave);
      for (const other of row.querySelectorAll('[data-wave]')) {
        const selected = other === button;
        other.classList.toggle('active', selected);
        other.setAttribute('aria-pressed', String(selected));
      }
    });
  }
  row.querySelector('.octave').addEventListener('change', e => synth.setOscillatorParameter(index, 'octave', Number(e.target.value)));
  row.querySelector('.detune').addEventListener('input', e => {
    const n = Number(e.target.value);
    synth.setOscillatorParameter(index, 'detune', n);
    row.querySelector('.detune-value').textContent = `${n > 0 ? '+' : ''}${n}¢`;
  });
  row.querySelector('.level').addEventListener('input', e => {
    const n = Number(e.target.value);
    synth.setOscillatorParameter(index, 'level', n / 100);
    row.querySelector('.level-value').textContent = `${n}%`;
  });
}

// C4 through C5: white-note keyboard keys and black notes between them.
const keyMap = {
  KeyA: 60, KeyW: 61, KeyS: 62, KeyE: 63,
  KeyD: 64, KeyF: 65, KeyT: 66, KeyG: 67,
  KeyY: 68, KeyH: 69, KeyU: 70, KeyJ: 71, KeyK: 72,
};
const keyLabels = Object.fromEntries(Object.entries(keyMap).map(([code, note]) => [note, code.replace('Key', '')]));
const whiteNotes = [60, 62, 64, 65, 67, 69, 71, 72];
const blackAfter = new Map([[60, 61], [62, 63], [65, 66], [67, 68], [69, 70]]);
const elements = new Map();
const sources = new Map(); // note => set of input IDs; allows mouse and keyboard together
const pointers = new Map();

function setActive(note, active) {
  elements.get(note)?.classList.toggle('pressed', active);
}
async function press(note, source) {
  let holders = sources.get(note);
  if (!holders) { holders = new Set(); sources.set(note, holders); }
  if (holders.has(source)) return;
  const alreadyPlaying = holders.size > 0;
  holders.add(source);
  setActive(note, true);
  if (!alreadyPlaying) {
    try {
      await synth.noteOn(note);
      // Handles releasing a key before the audio context finishes unlocking.
      if (!sources.get(note)?.size) synth.noteOff(note);
      status.textContent = 'Audio running';
    } catch (error) {
      status.textContent = `Audio error: ${error.message}`;
      release(note, source);
    }
  }
}
function release(note, source) {
  const holders = sources.get(note);
  if (!holders) return;
  holders.delete(source);
  if (!holders.size) {
    sources.delete(note);
    setActive(note, false);
    synth.noteOff(note);
  }
}
function releaseAll() {
  for (const [note] of sources) { sources.delete(note); setActive(note, false); }
  pointers.clear();
  synth.stopAll();
}

for (let i = 0; i < whiteNotes.length; i++) {
  const note = whiteNotes[i];
  const white = document.createElement('button');
  white.type = 'button'; white.className = 'piano-key white';
  white.dataset.note = String(note);
  white.innerHTML = `<span>${keyLabels[note]}</span>`;
  white.setAttribute('aria-label', `Play MIDI note ${note}`);
  white.style.setProperty('--position', String(i));
  keyboard.appendChild(white);
  elements.set(note, white);

  if (blackAfter.has(note)) {
    const blackNote = blackAfter.get(note);
    const black = document.createElement('button');
    black.type = 'button'; black.className = 'piano-key black';
    black.dataset.note = String(blackNote);
    black.innerHTML = `<span>${keyLabels[blackNote]}</span>`;
    black.setAttribute('aria-label', `Play MIDI note ${blackNote}`);
    black.style.setProperty('--position', String(i + 1));
    keyboard.appendChild(black);
    elements.set(blackNote, black);
  }
}

keyboard.addEventListener('pointerdown', (event) => {
  const key = event.target.closest('.piano-key');
  if (!key) return;
  event.preventDefault();
  const note = Number(key.dataset.note);
  const source = `pointer-${event.pointerId}`;
  pointers.set(event.pointerId, { note, source });
  keyboard.setPointerCapture(event.pointerId);
  press(note, source);
});
function pointerRelease(event) {
  const held = pointers.get(event.pointerId);
  if (!held) return;
  pointers.delete(event.pointerId);
  release(held.note, held.source);
}
keyboard.addEventListener('pointerup', pointerRelease);
keyboard.addEventListener('pointercancel', pointerRelease);
keyboard.addEventListener('lostpointercapture', pointerRelease);

window.addEventListener('keydown', (event) => {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  const note = keyMap[event.code];
  if (note === undefined) return;
  event.preventDefault();
  press(note, `key-${event.code}`);
});
window.addEventListener('keyup', (event) => {
  const note = keyMap[event.code];
  if (note !== undefined) release(note, `key-${event.code}`);
});
window.addEventListener('blur', releaseAll);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
document.getElementById('panic').addEventListener('click', releaseAll);

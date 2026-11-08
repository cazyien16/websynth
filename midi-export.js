// Standard MIDI File (SMF format 0), with PPQ timing.
// Each piano-roll step is one sixteenth note.
const PPQ = 480;
const TICKS_PER_STEP = PPQ / 4;
const u16 = n => [(n >>> 8) & 255, n & 255];
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const ascii = s => Array.from(s, c => c.charCodeAt(0));

function vlq(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0x0fffffff) throw new Error('Invalid MIDI delta time.');
  const result = [n & 127];
  while ((n = Math.floor(n / 128)) > 0) result.unshift((n & 127) | 128);
  return result;
}

export function encodePatternToMidi({notes, bpm, numerator = 4, totalSteps}) {
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isInteger(totalSteps) || totalSteps < 1) {
    throw new Error('Invalid pattern duration or BPM.');
  }
  if (![2, 3, 4, 6].includes(numerator)) throw new Error('Unsupported time signature.');

  const microsecondsPerQuarter = Math.round(60000000 / bpm);
  if (microsecondsPerQuarter < 1 || microsecondsPerQuarter > 0xffffff) throw new Error('BPM out of MIDI tempo range.');
  const events = [];
  let order = 0;
  const add = (tick, priority, bytes) => events.push({tick, priority, bytes, order:order++});
  add(0, 0, [0xff, 0x51, 0x03, (microsecondsPerQuarter >>> 16) & 255, (microsecondsPerQuarter >>> 8) & 255, microsecondsPerQuarter & 255]);
  add(0, 0, [0xff, 0x58, 0x04, numerator, 2, 24, 8]); // denominator 2^2 = 4
  add(0, 0, [0xc0, 0]); // acoustic grand piano, channel 1

  for (const note of notes) {
    const {pitch, step, length} = note;
    if (![pitch, step, length].every(Number.isInteger)) continue;
    if (pitch < 0 || pitch > 127 || step < 0 || step >= totalSteps || length < 1) continue;
    const end = Math.min(totalSteps, step + length);
    add(step * TICKS_PER_STEP, 2, [0x90, pitch, 100]);
    add(end * TICKS_PER_STEP, 1, [0x80, pitch, 0]); // note-offs before note-ons at same tick
  }
  const lastTick = totalSteps * TICKS_PER_STEP;
  events.sort((a, b) => a.tick - b.tick || a.priority - b.priority || a.order - b.order);
  const track = [];
  let previousTick = 0;
  for (const event of events) {
    track.push(...vlq(event.tick - previousTick), ...event.bytes);
    previousTick = event.tick;
  }
  track.push(...vlq(lastTick - previousTick), 0xff, 0x2f, 0x00);
  const data = new Uint8Array([
    ...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(PPQ),
    ...ascii('MTrk'), ...u32(track.length), ...track
  ]);
  return new Blob([data], {type:'audio/midi'});
}

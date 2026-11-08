import {SpectraSynth} from './synth.js';
import {readMidi} from './midi.js';
const synth=new SpectraSynth();
const $=id=>document.getElementById(id);
const status=$('statusText');
const midiName=n=>{
  const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
  return names[n%12]+(Math.floor(n/12)-1);
};
const isBlack=n=>[1,3,6,8,10].includes(n%12);
const cutoffFromSlider=v=>80*Math.pow(16000/80,Number(v)/100);
for(const [key,fmt,convert] of [
  ['attack',v=>v.toFixed(3)+' s'],['decay',v=>v.toFixed(2)+' s'],
  ['sustain',v=>Math.round(v*100)+'%'],['release',v=>v.toFixed(2)+' s'],
  ['cutoff',v=>Math.round(v).toLocaleString()+' Hz',cutoffFromSlider],
  ['resonance',v=>v.toFixed(1)],['volume',v=>Math.round(v*100)+'%']
]) {
  const slider=$(key), output=$(key+'Value');
  const update=()=>{const v=convert?convert(slider.value):Number(slider.value);synth.setParameter(key,v);output.textContent=fmt(v);};
  slider.addEventListener('input',update);update();
}
for(const button of document.querySelectorAll('[data-wave]')) {
  button.addEventListener('click',()=>{
    synth.setParameter('waveform',button.dataset.wave);
    for(const b of document.querySelectorAll('[data-wave]'))b.classList.toggle('active',b===button);
  });
}
// Extended keyboard: C3–B5, 21 white keys and their intervening black keys.
const keyElements=new Map(), holders=new Map(), pointers=new Map();
const keyboard=$('keyboard');
let whiteIndex=0;
for(let note=48;note<=83;note++){
  const black=isBlack(note);
  const button=document.createElement('button');
  button.type='button';button.className='piano-key '+(black?'black':'white');
  button.dataset.note=note;
  button.title=midiName(note);
  button.setAttribute('aria-label','Play '+midiName(note));
  if(black)button.style.setProperty('--index',whiteIndex);
  else {button.innerHTML='<span>'+midiName(note)+'</span>';whiteIndex++;}
  keyboard.appendChild(button);keyElements.set(note,button);
}
async function press(note,source){
  let set=holders.get(note);
  if(!set){set=new Set();holders.set(note,set);}
  if(set.has(source))return;
  const first=set.size===0;set.add(source);
  keyElements.get(note)?.classList.add('pressed');
  if(first)try{
    await synth.noteOn(note);
    if(!holders.has(note))synth.noteOff(note);
    status.textContent='Audio running';
  }catch(error){status.textContent='Audio error: '+error.message;release(note,source);}
}
function release(note,source){
  const set=holders.get(note);if(!set)return;
  set.delete(source);
  if(!set.size){holders.delete(note);keyElements.get(note)?.classList.remove('pressed');synth.noteOff(note);}
}
function releaseAll(){
  holders.clear();pointers.clear();
  for(const b of keyElements.values())b.classList.remove('pressed');
  synth.stopAll();
}
keyboard.addEventListener('pointerdown',e=>{
  const target=e.target.closest('.piano-key');if(!target)return;
  e.preventDefault();
  const note=Number(target.dataset.note),source='p'+e.pointerId;
  pointers.set(e.pointerId,{note,source});
  target.setPointerCapture(e.pointerId);
  press(note,source);
});
const endPointer=e=>{const data=pointers.get(e.pointerId);if(data){pointers.delete(e.pointerId);release(data.note,data.source);}};
keyboard.addEventListener('pointerup',endPointer);keyboard.addEventListener('pointercancel',endPointer);keyboard.addEventListener('lostpointercapture',endPointer);
window.addEventListener('blur',()=>{stopTransport();releaseAll();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopTransport();releaseAll();}});
$('panic').addEventListener('click',()=>{stopTransport();releaseAll();status.textContent='All notes stopped';});

// First-edition piano roll; coordinates are 1/16-note steps, pitches MIDI 48..83.
const notes=new Map(); // "pitch:step" => {pitch,step,length}; replaceable, independent note data
let playing=false, timer=null, frame=null, transportStart=0, nextStep=0, lastPlayhead=-1;
let totalSteps=64;
const stepsPerMeasure=()=>Number($('timeSig').value)*4;
const selectedMeasures=()=>Number($('measures').value);
const configuredSteps=()=>stepsPerMeasure()*selectedMeasures();
function selectedBpm(){return Math.max(40,Math.min(240,Number($('bpm').value)||120));}
function noteKey(pitch,step){return pitch+':'+step;}
function updateInfo(message=''){
  $('rollInfo').textContent=`${notes.size} notes · ${selectedMeasures()} measures · ${selectedBpm()} BPM`;
  if(message)$('importStatus').textContent=message;
}
function renderRoll(){
  totalSteps=configuredSteps();
  const roll=$('pianoRoll');
  roll.replaceChildren();
  const frag=document.createDocumentFragment();
  const spacer=document.createElement('div');spacer.className='roll-header spacer';frag.appendChild(spacer);
  const head=document.createElement('div');head.className='roll-header timeline';
  head.style.width=(totalSteps*26)+'px';
  for(let m=0;m<selectedMeasures();m++){
    const mark=document.createElement('div');mark.className='measure-marker';
    mark.style.width=(stepsPerMeasure()*26)+'px';mark.textContent='Measure '+(m+1);
    head.appendChild(mark);
  }
  frag.appendChild(head);
  for(let pitch=83;pitch>=48;pitch--){
    const label=document.createElement('div');label.className='roll-label'+(isBlack(pitch)?' sharp':'');label.textContent=midiName(pitch);frag.appendChild(label);
    const line=document.createElement('div');line.className='roll-line'+(isBlack(pitch)?' sharp':'');
    line.dataset.pitch=pitch;
    const covered=new Set();
    for(const n of notes.values())if(n.pitch===pitch)for(let s=n.step;s<Math.min(totalSteps,n.step+n.length);s++)covered.add(s);
    for(let s=0;s<totalSteps;s++){
      const cell=document.createElement('button');cell.type='button';cell.className='roll-cell';
      if(s%stepsPerMeasure()===0)cell.classList.add('bar');
      else if(s%4===0)cell.classList.add('beat');
      if(covered.has(s))cell.classList.add('note');
      cell.dataset.step=s;cell.dataset.pitch=pitch;
      cell.title=midiName(pitch)+' · beat '+(1+s/4);
      cell.setAttribute('aria-label',`${midiName(pitch)}, step ${s+1}`);
      line.appendChild(cell);
    }
    frag.appendChild(line);
  }
  roll.appendChild(frag);updateInfo();
}
$('pianoRoll').addEventListener('click',e=>{
  const cell=e.target.closest('.roll-cell');if(!cell)return;
  const pitch=Number(cell.dataset.pitch),step=Number(cell.dataset.step);
  let existing=[...notes.values()].find(n=>n.pitch===pitch&&n.step<=step&&step<n.step+n.length);
  if(existing)notes.delete(noteKey(existing.pitch,existing.step));
  else {
    let length=Math.min(Number($('noteLength').value),totalSteps-step);
    // Avoid overlapping adjacent note starts on the same pitch.
    for(const n of notes.values())if(n.pitch===pitch&&n.step>step)length=Math.min(length,n.step-step);
    if(length>0)notes.set(noteKey(pitch,step),{pitch,step,length});
  }
  if(playing)stopTransport();
  renderRoll();
});
$('clearPattern').addEventListener('click',()=>{stopTransport();notes.clear();renderRoll();updateInfo('Pattern cleared.');});
for(const name of ['timeSig','measures'])$(name).addEventListener('change',()=>{
  stopTransport();
  const limit=configuredSteps();
  for(const [key,n] of notes){
    if(n.step>=limit)notes.delete(key);
    else n.length=Math.min(n.length,limit-n.step);
  }
  renderRoll();
});
$('bpm').addEventListener('change',()=>{$('bpm').value=selectedBpm();stopTransport();updateInfo();});
$('playPattern').addEventListener('click',async()=>{
  if(playing){stopTransport();return;}
  try{await synth.init();startTransport();}catch(error){status.textContent='Playback error: '+error.message;}
});
$('stopPattern').addEventListener('click',stopTransport);
function startTransport(){
  stopTransport();playing=true;nextStep=0;lastPlayhead=-1;
  const ctx=synth.context;
  transportStart=ctx.currentTime+.055;
  $('playPattern').textContent='❚❚ Playing';status.textContent='Sequencer playing';
  const secPerStep=60/selectedBpm()/4;
  const schedule=()=>{
    if(!playing)return;
    const now=ctx.currentTime;
    while(transportStart+nextStep*secPerStep < now+.15){
      if(nextStep>=totalSteps){
        if($('loop').checked)transportStart+=totalSteps*secPerStep;
        else {if(now>=transportStart+totalSteps*secPerStep){stopTransport();return;}break;}
        nextStep=0;
      }
      const s=nextStep;
      for(const note of notes.values())if(note.step===s){
        const time=transportStart+s*secPerStep;
        synth.scheduleNote(note.pitch,time,note.length*secPerStep);
      }
      nextStep++;
    }
  };
  schedule();timer=setInterval(schedule,25);
  const animate=()=>{
    if(!playing)return;
    const now=ctx.currentTime;
    let step=Math.floor((now-transportStart)/secPerStep);
    if($('loop').checked)step=((step%totalSteps)+totalSteps)%totalSteps;
    if(step>=totalSteps&&!$('loop').checked){stopTransport();return;}
    if(step>=0&&step!==lastPlayhead){
      for(const c of document.querySelectorAll('.roll-cell.playhead'))c.classList.remove('playhead');
      for(const c of document.querySelectorAll(`.roll-cell[data-step="${step}"]`))c.classList.add('playhead');
      lastPlayhead=step;
    }
    frame=requestAnimationFrame(animate);
  };
  frame=requestAnimationFrame(animate);
}
function stopTransport(){
  if(timer!==null){clearInterval(timer);timer=null;}
  if(frame!==null){cancelAnimationFrame(frame);frame=null;}
  if(playing){synth.stopAll();playing=false;}
  $('playPattern').textContent='▶ Play';
  for(const c of document.querySelectorAll('.roll-cell.playhead'))c.classList.remove('playhead');
  lastPlayhead=-1;
}
$('midiFile').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const parsed=readMidi(await file.arrayBuffer());
    stopTransport();notes.clear();
    const wantedSig=[2,3,4,6].includes(parsed.numerator)?parsed.numerator:4;
    $('timeSig').value=String(wantedSig);
    $('bpm').value=parsed.bpm;
    const totalWanted=Math.max(1,...parsed.notes.map(n=>Math.round((n.startBeats+n.durationBeats)*4)));
    const possibleMeasures=[1,2,4,8];
    const bars=Math.ceil(totalWanted/(wantedSig*4));
    const selected=possibleMeasures.find(v=>v>=bars)||8;
    $('measures').value=String(selected);
    const maxStep=selected*wantedSig*4;
    let ignored=0;
    for(const n of parsed.notes){
      const step=Math.round(n.startBeats*4),length=Math.max(1,Math.round(n.durationBeats*4));
      if(n.pitch<48||n.pitch>83||step>=maxStep){ignored++;continue;}
      notes.set(noteKey(n.pitch,step),{pitch:n.pitch,step,length:Math.min(length,maxStep-step)});
    }
    renderRoll();
    updateInfo(`Imported ${notes.size} notes (${ignored} outside range). First tempo used; tempo changes not preserved. Notes quantized to 1/16.`);
  }catch(error){$('importStatus').textContent='MIDI import failed: '+error.message;}
  finally{e.target.value='';}
});
renderRoll();

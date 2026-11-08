// Standard MIDI File reader (SMF Type 0 / Type 1, PPQ timing).
// Parses note-on/note-off, initial tempo and time signature; the sequencer quantizes to 1/16.
export function readMidi(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  let i = 0;
  const need = n => { if (i+n > view.byteLength) throw new Error('Truncated MIDI file.'); };
  const u8 = () => { need(1); return view.getUint8(i++); };
  const u16 = () => { need(2); const v=view.getUint16(i); i+=2; return v; };
  const u32 = () => { need(4); const v=view.getUint32(i); i+=4; return v; };
  const str = n => { need(n); let s=''; for(let k=0;k<n;k++)s+=String.fromCharCode(u8()); return s; };
  const varLen = () => {
    let n=0;
    for(let k=0;k<4;k++) { const c=u8(); n=(n<<7)|(c&127); if(!(c&128))return n; }
    throw new Error('Invalid MIDI variable-length value.');
  };
  if(str(4)!=='MThd') throw new Error('Not a Standard MIDI File.');
  const headerLength=u32();
  if(headerLength<6)throw new Error('Invalid MIDI header.');
  const format=u16(), tracks=u16(), division=u16();
  if(format>1)throw new Error('Only MIDI Type 0 and Type 1 are supported.');
  if(division&0x8000)throw new Error('SMPTE-timed MIDI files are not supported.');
  if(!division)throw new Error('Invalid MIDI time resolution.');
  i+=headerLength-6;
  let bpm=120, numerator=4, firstTempoTime=Infinity, firstSignatureTime=Infinity;
  const notes=[];
  for(let track=0;track<tracks;track++) {
    if(str(4)!=='MTrk') throw new Error('Missing MIDI track header.');
    const size=u32(), end=i+size;
    if(end>view.byteLength)throw new Error('Truncated MIDI track.');
    let time=0,running=0;
    const active=new Map();
    const close=(key, tick) => {
      const stack=active.get(key);
      if(!stack?.length)return;
      const previous=stack.shift();
      if(tick>previous.tick)notes.push({pitch:previous.pitch,startBeats:previous.tick/division,durationBeats:(tick-previous.tick)/division});
    };
    while(i<end) {
      time+=varLen();
      let status=u8();
      if(status<0x80) {
        if(!running)throw new Error('Unexpected MIDI running status.');
        i--;
        status=running;
      } else if(status<0xf0) running=status;
      if(status===0xff) {
        const type=u8(), len=varLen();
        const endMeta=i+len;
        if(endMeta>end)throw new Error('Invalid MIDI metadata.');
        if(type===0x51&&len===3&&time<firstTempoTime) {
          const micros=(view.getUint8(i)<<16)|(view.getUint8(i+1)<<8)|view.getUint8(i+2);
          if(micros>0){ bpm=Math.round(60000000/micros);firstTempoTime=time; }
        }
        if(type===0x58&&len>=2&&time<firstSignatureTime) {
          const n=view.getUint8(i), denom=2**view.getUint8(i+1);
          if(denom===4&&[2,3,4,6].includes(n)){numerator=n;firstSignatureTime=time;}
        }
        i=endMeta;
        if(type===0x2f)break;
      } else if(status===0xf0||status===0xf7) {
        const len=varLen();need(len);i+=len;
      } else {
        const command=status&0xf0, channel=status&0x0f;
        if(command<0x80||command>0xe0)throw new Error('Unsupported MIDI event.');
        const pitch=u8();
        const second=(command===0xc0||command===0xd0)?0:u8();
        if(command===0x90&&second>0) {
          const key=channel+':'+pitch;
          if(!active.has(key))active.set(key,[]);
          active.get(key).push({pitch,tick:time});
        } else if(command===0x80||(command===0x90&&second===0)) close(channel+':'+pitch,time);
      }
      if(i>end)throw new Error('MIDI track event exceeds track length.');
    }
    for(const key of active.keys())while(active.get(key).length)close(key,time);
    i=end;
  }
  return {notes, bpm:Math.max(40,Math.min(240,bpm)), numerator, format};
}

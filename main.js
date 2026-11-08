:root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, Arial, sans-serif; background: #10111a; color: #f2f4f8; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 80% 0, #26223b 0, transparent 43%), #10111a; }
button, input { font: inherit; }
button { cursor: pointer; }
.app { max-width: 1180px; margin: 0 auto; padding: 38px 24px 52px; }
.topbar { display: flex; justify-content: space-between; gap: 24px; align-items: center; margin-bottom: 34px; }
.eyebrow { margin: 0 0 8px; font-size: 11px; font-weight: 750; letter-spacing: .18em; color: #a394fb; }
h1 { font-size: clamp(40px, 7vw, 70px); margin: 0; line-height: 1; letter-spacing: -.065em; font-weight: 850; }
.dot { color: #ab96ff; }
.subhead { color: #9a9aac; font-size: 14px; margin: 12px 0 0; }
.status { display: flex; align-items: center; gap: 9px; color: #b9b8c9; background: #222331; border: 1px solid #383748; padding: 11px 14px; border-radius: 999px; font-size: 12px; }
.status-light { width: 7px; height: 7px; background: #8be2aa; border-radius: 50%; flex-shrink: 0; }
.panels { display: grid; grid-template-columns: minmax(340px, 1.5fr) minmax(260px, 1fr) minmax(260px, 1fr); gap: 15px; }
.panel { background: #1b1c28; border: 1px solid #363646; border-radius: 18px; padding: 25px 23px; min-width: 0; }
.panel-header { display: flex; align-items: center; gap: 10px; }
.num { color: #a595f1; font-size: 12px; font-weight: 800; }
h2 { margin: 0; font-size: 15px; letter-spacing: .07em; }
.help { color: #87879d; font-size: 12px; margin: 10px 0 25px; }
.wave-picker { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 26px; }
.wave { background: #252636; color: #b6b5c8; border: 1px solid #3d3c50; border-radius: 12px; min-height: 82px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; font-size: 10px; font-weight: 800; letter-spacing: .05em; }
.wave-symbol { font-size: 30px; font-weight: 400; line-height: 1; }
.wave.active, .wave:hover { color: #ebe5ff; background: #37304e; border-color: #ad9bff; }
.control { margin: 0 0 22px; }
.control-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12px; }
.control-row label { color: #e2e1ec; }
.control-row output { color: #b6a5ff; font-variant-numeric: tabular-nums; }
input[type="range"] { display: block; width: 100%; margin: 12px 0 0; accent-color: #ac96ff; cursor: pointer; }
.panic { margin-top: 4px; width: 100%; border: 1px solid #645a7a; background: #302a42; color: #e5dcff; font-weight: 700; border-radius: 10px; padding: 12px; font-size: 11px; letter-spacing: .08em; }
.panic:hover { background: #44395f; }
.keyboard-section { margin-top: 20px; padding: 27px 29px; border: 1px solid #363646; background: #1b1c28; border-radius: 18px; }
.keyboard-heading { display: flex; justify-content: space-between; align-items: end; gap: 16px; margin-bottom: 24px; }
.keyboard-heading p:not(.eyebrow) { color: #9796aa; font-size: 12px; margin: 0; text-align: right; }
.keyboard-heading strong { color: #d7cafa; }
.keyboard { position: relative; height: 215px; display: flex; gap: 3px; user-select: none; touch-action: none; }
.piano-key { -webkit-tap-highlight-color: transparent; user-select: none; display: flex; justify-content: center; align-items: end; padding-bottom: 14px; font-size: 12px; font-weight: 700; }
.piano-key.white { position: relative; flex: 1; background: linear-gradient(#f1eff8, #bfc0d0); border: 1px solid #eceaf3; border-radius: 0 0 10px 10px; color: #6f7088; }
.piano-key.white.pressed { background: #ae9afa; color: #fff; }
.piano-key.black { position: absolute; z-index: 1; top: 0; left: calc(var(--position) * 12.5% - 3.3%); width: 6.6%; height: 63%; background: linear-gradient(#27283b, #090a10); border: 1px solid #36374b; border-radius: 0 0 8px 8px; color: #c0bdd3; box-shadow: 0 5px 8px #0006; }
.piano-key.black.pressed { background: #6952bf; }
.footnote { display: flex; justify-content: space-between; gap: 20px; margin-top: 18px; color: #89889d; font-size: 11px; }
button:focus-visible, input:focus-visible { outline: 2px solid #b9aaff; outline-offset: 3px; }
@media (max-width: 850px) { .panels { grid-template-columns: 1fr 1fr; } .panel:last-child { grid-column: span 2; } .topbar { align-items: start; flex-direction: column; } }
@media (max-width: 600px) { .app { padding: 24px 12px; } .panels { grid-template-columns: 1fr; } .panel:last-child { grid-column: auto; } .keyboard-section { padding: 18px 12px; } .keyboard-heading { align-items: start; flex-direction: column; } .keyboard-heading p:not(.eyebrow) { text-align: left; } .keyboard { height: 150px; } .footnote { flex-direction: column; gap: 5px; } }

/* SPECTRA v0.2: compact three-oscillator module, inspired by classic subtractive synths. */
.oscillator-panel { padding: 22px; }
.oscillator-panel .help { margin-bottom: 16px; line-height: 1.55; }
.oscillator-controls { display: flex; flex-direction: column; gap: 10px; }
.osc-row { background: #242534; border: 1px solid #3b3b50; border-radius: 12px; padding: 13px; }
.osc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.osc-number { color: #ddd5ff; font-weight: 850; font-size: 12px; letter-spacing: .08em; }
.osc-label { color: #8b899f; font-weight: 800; font-size: 9px; letter-spacing: .14em; }
.wave-picker.compact { grid-template-columns: repeat(4,1fr); gap: 5px; margin-bottom: 13px; }
.wave-picker.compact .wave { min-height: 35px; padding: 4px 2px; border-radius: 7px; font-size: 10px; letter-spacing: 0; }
.osc-knobs { display: grid; grid-template-columns: 78px minmax(0,1fr) minmax(0,1fr); gap: 12px; align-items: end; }
.osc-knobs label { color: #bebdd1; font-size: 11px; min-width: 0; }
.osc-knobs output { float: right; color: #c1aeff; font-size: 10px; }
.osc-knobs input[type="range"] { margin-top: 10px; }
.osc-knobs select { margin-top: 7px; display: block; background: #171925; color: #f1edff; border: 1px solid #4b4568; border-radius: 7px; width: 100%; padding: 7px; }
.osc-tip { margin: 14px 0 0; font-size: 11px; color: #a3a0b7; line-height: 1.5; }
@media (max-width: 1050px) { .panels { grid-template-columns: minmax(0,1fr) minmax(0,1fr); } .oscillator-panel { grid-column: 1/-1; } .panel:last-child { grid-column: auto; } }
@media (max-width: 600px) { .panels { grid-template-columns: 1fr; } .oscillator-panel, .panel:last-child { grid-column: auto; } .osc-knobs { gap: 7px; grid-template-columns: 70px 1fr 1fr; } }

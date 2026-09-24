import { CHIP_CSS, GLOW_CSS, HOT } from "src/shared/theme.ts";

// lives inside the shadow root, so civitai css never reaches it and it never reaches civitai
export const CARD_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
${GLOW_CSS}
${CHIP_CSS}
/* fixed at the chip's viewport rect: must beat .popover's absolute, anchor relative placement */
.popover.target-pop { position: fixed; right: auto; width: 380px; z-index: 50; }
.target-pop .target-row select { width: 130px; } .target-pop .target-row .combo { width: 170px; }
.file-row { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.file-row select { flex: 1; }
/* docked: a full width strip under civitai's header, one wrapping row */
.tagbar {
  position: relative; isolation: isolate; color: #f1f3f5; font-size: 13px; line-height: 1.25;
  background: linear-gradient(#141517, #141517) padding-box, ${HOT} border-box;
  border: 2px solid transparent; border-radius: 10px;
}
.tagbar::after {
  content: ""; position: absolute; inset: -2px; border-radius: inherit; pointer-events: none; z-index: -1;
  box-shadow: 0 0 8px 2px rgba(255, 23, 68, .7), 0 0 16px 4px rgba(255, 145, 0, .3);
  opacity: .3; animation: lmf-pulse 1.8s ease-in-out infinite; will-change: opacity;
}
@media (prefers-reduced-motion: reduce) { .tagbar::after { animation: none; opacity: .5; } }
.brand { font-size: 10px; font-weight: 900; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px;
  background: ${HOT}; color: #fff; }
.title { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: #adb5bd; font-size: 12px; margin-bottom: 4px; }
p { margin: 4px 0; }
.muted { color: #adb5bd; }
.error { color: #ff8787; word-break: break-word; font-weight: 600; }
.good { color: #69db7c; font-weight: 600; }
.status { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 800; }
.rule { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: #ffa94d; }
label { display: grid; gap: 2px; font-size: 11px; color: #adb5bd; }
select, input {
  width: 100%; padding: 4px 6px; border-radius: 6px; font-size: 13px;
  background: #25262b; color: #f1f3f5; border: 1px solid #495057;
}
button {
  cursor: pointer; padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 600;
  background: #2c2e33; color: #f1f3f5; border: 1px solid #495057;
}
button:disabled { opacity: .55; cursor: default; }
button.primary { flex: 1; font-size: 13px; font-weight: 800; padding: 5px 10px; }
button.icon { padding: 0 6px; background: none; border: none; font-size: 15px; color: #adb5bd; }
button.icon.on { color: #ffa94d; }
button.link { background: none; border: none; color: #74c0fc; padding: 0 0 0 6px; }
.tools { position: relative; }
/* popovers can sit outside a frame (the target editor): they carry their own text colors */
.popover { color: #f1f3f5; font-size: 13px; line-height: 1.25; }
.popover { position: absolute; z-index: 20; top: calc(100% + 8px); right: -4px; width: 320px; padding: 8px 10px;
  text-align: left; cursor: default; background: #1f2023; border: 1px solid #5c5f66; border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,.65); }
.popover-head { display: flex; justify-content: space-between; align-items: center; font-weight: 800;
  font-size: 12px; margin-bottom: 6px; }
.row { display: flex; gap: 6px; }
.row input { flex: 1; min-width: 0; }
.restart { margin-top: 8px; }
.tagbar { display: flex; align-items: center; gap: 6px; padding: 4px 10px; flex-wrap: wrap;
  max-width: calc(100vw - 32px); }
.tagbar select { width: 200px; } .tagbar .combo { width: 200px; }
.tagname { font-size: 13px; white-space: nowrap; }
.tagname b { font-weight: 800; color: #ffa94d; }
.saved { padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 12px; }
.tagpill { border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 800; }
/* tag bar placement: its own strip under civitai's header, or floating */
:host([data-mode="docked"]) .tagwrap { display: flex; justify-content: flex-start; padding: 4px 12px;
  background: #141517; border-bottom: 1px solid #373a40; }
:host([data-mode="floating"]) .tagwrap { position: fixed; left: 18px; bottom: 18px; z-index: 2147483000;
  max-width: calc(100vw - 380px); }
:host([data-mode="custom"]) .tagwrap { position: fixed; z-index: 2147483000; max-width: calc(100vw - 32px); }
.grip { cursor: grab; touch-action: none; user-select: none; font-size: 16px; color: #ffa94d; padding: 0 2px; }
.grip:active { cursor: grabbing; }
.docknote { margin: 4px 0; font-size: 12px; flex-basis: 100%; }
/* the "/" between root and subfolder only reads right on one row */
.sep { display: none; color: #adb5bd; }
:host([data-mode="docked"]) .sep { display: inline; }
/* inside a glowing frame the frame is enough: buttons keep the gradient, lose the halo */
.tagbar .lmf-hot::after, .tagbar .lmf-cool::after { display: none; }
/* tools: top right on the floating card, last item on the docked row */
.tools { display: inline-flex; align-items: center; gap: 2px; }
/* version chip */
.vchip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px;
  font-size: 12px; font-weight: 700; background: #25262b; border: 1px solid #5c5f66; }
.vchip:hover { border-color: #ffa94d; }
.vchip-base { font-size: 10px; font-weight: 800; padding: 0 5px; border-radius: 4px; background: #373a40; color: #ffd8a8; }
/* one row height for both docked strips: a 40px frame, 26px controls */
:host([data-mode="docked"]) :is(select, input, button:not(.icon):not(.link)),
:host([data-mode="docked"]) :is(.status, .saved, .vchip) { height: 26px; box-sizing: border-box; }
:host([data-mode="docked"]) :is(.status, .saved, .vchip) { display: inline-flex; align-items: center; }
:host([data-mode="docked"]) .tagwrap { padding: 4px 12px; }
:host([data-mode="docked"]) :is(.grip, .brand, button.icon) { line-height: 1; }
button.basebtn { font-size: 11px; font-weight: 800; color: #ffa94d; border: 1px dashed #ffa94d; border-radius: 5px;
  padding: 0 6px; height: 22px; }
/* newer version */
/* rules: strip, button, popover (agent/spec.md "rules") */
.here { font-size: 12px; color: #ced4da; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 520px; }
.here b { color: #ffa94d; }
.rule.none { color: #adb5bd; font-weight: 600; font-style: italic; }
.rules-anchor { position: relative; display: inline-block; }
.rules-btn { font-weight: 800; }
.rules-btn.on { border-color: #ffa94d; color: #ffa94d; }
.popover.rules-pop { left: 0; right: auto; width: min(620px, 94vw); max-height: 72vh; overflow-y: auto; }
.tools .popover.rules-pop { left: auto; right: 0; }
button.small { padding: 1px 8px; font-size: 12px; height: 22px; }
button.small.on { border-color: #ffa94d; color: #ffa94d; }
.rule-list { margin: 0 0 6px; padding: 0 0 0 22px; }
.rule-list li { display: flex; align-items: center; gap: 8px; padding: 3px 4px; border-radius: 6px; }
.rule-list li.on { background: #2c2e33; }
.rule-cond { font-weight: 700; }
.rule-target { color: #adb5bd; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-tools { display: inline-flex; flex: none; }
.rule-editor { border-top: 1px solid #373a40; padding-top: 8px; display: grid; gap: 8px; }
.editor-title { font-weight: 800; font-size: 12px; }
.dirty { color: #ffa94d; font-weight: 600; }
.cond-row, .target-row, .save-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.target-row select { width: 170px; } .target-row .combo { width: 220px; }
.save-row { justify-content: flex-end; }
.save-row .muted { margin-right: auto; font-size: 12px; }
.kw { font-weight: 900; color: #ffa94d; font-size: 12px; }
.cond { display: inline-flex; align-items: center; gap: 4px; padding: 1px 4px 1px 7px; border-radius: 999px;
  background: #2c2e33; border: 1px solid #5c5f66; font-size: 12px; font-weight: 700; }
.cond-field { font-size: 10px; text-transform: uppercase; color: #adb5bd; font-weight: 800; }
.cond-bases { border-color: #74c0fc; } .cond-words { border-color: #b197fc; } .cond-tags { border-color: #ffa94d; }
.cond-x { border: none; background: none; padding: 0 3px; font-size: 11px; color: #adb5bd; height: auto; }
.addcond { display: grid; gap: 4px; flex-basis: 100%; padding: 6px; border: 1px dashed #5c5f66; border-radius: 6px; }
.addcond .fields, .addcond .picks { display: flex; flex-wrap: wrap; gap: 4px; }
.addcond input { width: 100%; }
.rules-btn.focus-on { border-color: #74c0fc; color: #74c0fc; }
.bar-buttons { display: inline-flex; gap: 6px; }
.focus-field { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin: 6px 0; }
.focus-field .cond-field { width: 90px; flex: none; }
.focus-field input { width: 180px; height: 22px; }
.switch { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: #f1f3f5; cursor: pointer; }
.switch input { width: auto; }
/* subfolder combobox */
.combo { position: relative; display: inline-block; width: 100%; }
.combo input { padding-right: 52px; cursor: pointer; }
.combo input:focus { cursor: text; }
.chev { position: absolute; right: 7px; top: 50%; transform: translateY(-50%); pointer-events: none;
  font-size: 11px; color: #adb5bd; }
.newtag { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); pointer-events: none;
  font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px; background: ${HOT}; color: #fff; }
.combo-list { position: absolute; z-index: 10; left: 0; right: 0; top: calc(100% + 2px); margin: 0; padding: 4px 0;
  list-style: none; max-height: 260px; overflow-y: auto; min-width: 220px;
  background: #1f2023; border: 1px solid #495057; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.6); }
.combo-list li { padding: 4px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f1f3f5; }
.combo-list li.hi { background: #343a40; }
.combo-list .create { color: #ffa94d; font-weight: 700; }
`;

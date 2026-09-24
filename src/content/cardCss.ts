import { GLOW_CSS, HOT } from "src/shared/theme.ts";

// lives inside the shadow root, so civitai css never reaches it and it never reaches civitai
export const CARD_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
${GLOW_CSS}
.wrap { z-index: 2147483000; }
:host([data-mode="floating"]) .wrap { position: fixed; right: 18px; bottom: 18px; }
:host([data-mode="custom"]) .wrap { position: fixed; }
/* docked: a full width strip under civitai's header, one wrapping row */
:host([data-mode="docked"]) .wrap { position: relative; display: flex; justify-content: center;
  padding: 4px 12px; background: #141517; border-bottom: 1px solid #373a40; }
:host([data-mode="docked"]) .card { width: auto; max-width: 100%; display: flex; flex-wrap: wrap;
  align-items: center; gap: 4px 10px; padding: 4px 10px; }
:host([data-mode="docked"]) .card > header { margin: 0; gap: 6px; }
:host([data-mode="docked"]) .card > .title { display: none; }
:host([data-mode="docked"]) .card > .tools { order: 99; }
:host([data-mode="docked"]) .card > .sub { margin: 0; }
:host([data-mode="docked"]) .card > p { margin: 0; }
:host([data-mode="docked"]) .card > .folder { display: flex; align-items: center; gap: 6px; margin: 0; }
:host([data-mode="docked"]) .lbl { display: none; }
:host([data-mode="docked"]) .card > .folder select { width: 200px; }
:host([data-mode="docked"]) .card > .folder .combo { width: 200px; }
:host([data-mode="docked"]) .card > .folder .rule { align-self: center; }
:host([data-mode="docked"]) .card > .progress { flex: 1 1 160px; margin: 0; }
:host([data-mode="docked"]) .card > .actions { margin: 0; }
:host([data-mode="docked"]) .card > .actions .primary { flex: none; min-width: 100px; }
:host([data-mode="docked"]) .card > .where { max-width: 520px; }
:host([data-mode="docked"]) .card > .docknote { flex-basis: 100%; }
header { cursor: grab; touch-action: none; user-select: none; }
header:active { cursor: grabbing; }
.card, .tagbar {
  position: relative; isolation: isolate; color: #f1f3f5; font-size: 13px; line-height: 1.25;
  background: linear-gradient(#141517, #141517) padding-box, ${HOT} border-box;
  border: 2px solid transparent; border-radius: 10px;
}
.card::after, .tagbar::after {
  content: ""; position: absolute; inset: -2px; border-radius: inherit; pointer-events: none; z-index: -1;
  box-shadow: 0 0 8px 2px rgba(255, 23, 68, .7), 0 0 16px 4px rgba(255, 145, 0, .3);
  opacity: .3; animation: lmf-pulse 1.8s ease-in-out infinite; will-change: opacity;
}
@media (prefers-reduced-motion: reduce) { .card::after, .tagbar::after { animation: none; opacity: .5; } }
.card { width: 320px; padding: 8px 10px; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.brand { font-size: 10px; font-weight: 900; letter-spacing: .04em; padding: 1px 5px; border-radius: 4px;
  background: ${HOT}; color: #fff; }
.title { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: #adb5bd; font-size: 12px; margin-bottom: 4px; }
p { margin: 4px 0; }
.muted { color: #adb5bd; }
.error { color: #ff8787; word-break: break-word; font-weight: 600; }
.good { color: #69db7c; font-weight: 600; }
.status { display: inline-block; padding: 2px 10px; border-radius: 999px; font-weight: 800; }
.where { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; min-width: 0; }
.where-dir { font-weight: 700; color: #69db7c; word-break: break-all; }
.where-file { color: #adb5bd; font-size: 12px; word-break: break-all; }
.rule { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: #ffa94d; }
.folder { display: grid; gap: 4px; margin: 6px 0; }
label { display: grid; gap: 2px; font-size: 11px; color: #adb5bd; }
select, input {
  width: 100%; padding: 4px 6px; border-radius: 6px; font-size: 13px;
  background: #25262b; color: #f1f3f5; border: 1px solid #495057;
}
.actions { display: flex; gap: 6px; margin-top: 6px; }
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
.popover { position: absolute; z-index: 20; top: calc(100% + 8px); right: -4px; width: 320px; padding: 8px 10px;
  text-align: left; cursor: default; background: #1f2023; border: 1px solid #5c5f66; border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,.65); }
.popover-head { display: flex; justify-content: space-between; align-items: center; font-weight: 800;
  font-size: 12px; margin-bottom: 6px; }
.row { display: flex; gap: 6px; }
.row input { flex: 1; min-width: 0; }
.restart { margin-top: 8px; }
.pill { display: flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 12px;
  font-size: 13px; font-weight: 800; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; border: 1px solid #fff; }
.dot.good { background: #51cf66; } .dot.none { background: #868e96; }
.dot.bad { background: #ff6b6b; } .dot.wait { background: #fcc419; }
.progress { position: relative; height: 18px; border-radius: 6px; background: #25262b; overflow: hidden; margin: 6px 0; }
.progress .bar { position: absolute; inset: 0 auto 0 0; background: ${HOT}; transition: width .3s; }
.progress span { position: relative; font-size: 12px; font-weight: 800; padding-left: 8px; line-height: 18px;
  text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.tagbar { display: flex; align-items: center; gap: 6px; padding: 4px 10px; flex-wrap: wrap;
  max-width: calc(100vw - 32px); }
.tagbar select { width: 200px; } .tagbar .combo { width: 200px; }
.tagname { font-size: 13px; white-space: nowrap; }
.tagname b { font-weight: 800; color: #ffa94d; }
.saved { padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 12px; }
.tagpill { border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 800; }
/* tag bar placement: its own strip under civitai's header, or floating */
:host([data-mode="docked"]) .tagwrap { display: flex; justify-content: center; padding: 4px 12px;
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
.card .lmf-hot::after, .card .lmf-cool::after, .tagbar .lmf-hot::after, .tagbar .lmf-cool::after { display: none; }
/* tools: top right on the floating card, last item on the docked row */
.card { position: relative; }
.tools { display: inline-flex; align-items: center; gap: 2px; }
:host(:not([data-mode="docked"])) .card > .tools { position: absolute; top: 6px; right: 6px; }
/* version chip */
.vchip-wrap { position: relative; display: inline-block; }
.vchip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 9px; border-radius: 999px;
  font-size: 12px; font-weight: 700; background: #25262b; border: 1px solid #5c5f66; }
.vchip:hover { border-color: #ffa94d; }
.vchip-base { font-size: 10px; font-weight: 800; padding: 0 5px; border-radius: 4px; background: #373a40; color: #ffd8a8; }
.vlist { min-width: 240px; }
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

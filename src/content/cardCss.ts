import { GLOW_CSS, HOT } from "src/shared/theme.ts";

// lives inside the shadow root, so civitai css never reaches it and it never reaches civitai
export const CARD_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
${GLOW_CSS}
.wrap { position: fixed; right: 18px; bottom: 18px; z-index: 2147483000; }
.card, .tagbar {
  position: relative; isolation: isolate; color: #f1f3f5; font-size: 13px; line-height: 1.35;
  background: linear-gradient(#141517, #141517) padding-box, ${HOT} border-box;
  border: 3px solid transparent; border-radius: 14px;
}
.card::after, .tagbar::after {
  content: ""; position: absolute; inset: -3px; border-radius: inherit; pointer-events: none; z-index: -1;
  box-shadow: 0 0 16px 4px rgba(255, 23, 68, .85), 0 0 34px 10px rgba(255, 145, 0, .45);
  opacity: .35; animation: lmf-pulse 1.6s ease-in-out infinite; will-change: opacity;
}
@media (prefers-reduced-motion: reduce) { .card::after, .tagbar::after { animation: none; opacity: .8; } }
.card { width: 320px; padding: 12px 14px; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.brand { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
  background: ${HOT}; -webkit-background-clip: text; background-clip: text; color: transparent; }
.title { font-weight: 700; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: #adb5bd; font-size: 12px; margin-bottom: 8px; }
p { margin: 6px 0; }
.muted { color: #adb5bd; }
.error { color: #ff8787; word-break: break-word; font-weight: 600; }
.good { color: #69db7c; font-weight: 600; }
.status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-weight: 800; }
.rule { margin: 2px 0 0; font-size: 12px; font-weight: 700; color: #ffa94d; }
.folder { display: grid; gap: 6px; margin: 8px 0; }
label { display: grid; gap: 2px; font-size: 11px; color: #adb5bd; }
select, input {
  width: 100%; padding: 6px 8px; border-radius: 7px; font-size: 13px;
  background: #25262b; color: #f1f3f5; border: 1px solid #495057;
}
.actions { display: flex; gap: 8px; margin-top: 10px; }
button {
  cursor: pointer; padding: 7px 12px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: #2c2e33; color: #f1f3f5; border: 1px solid #495057;
}
button:disabled { opacity: .55; cursor: default; }
button.primary { flex: 1; font-size: 15px; font-weight: 800; padding: 9px 12px; }
button.icon { padding: 0 8px; background: none; border: none; font-size: 17px; color: #adb5bd; }
button.icon.on { color: #ffa94d; }
button.link { background: none; border: none; color: #74c0fc; padding: 0 0 0 6px; }
.server { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #373a40; }
.row { display: flex; gap: 6px; }
.row input { flex: 1; min-width: 0; }
.restart { margin-top: 8px; }
.pill { display: flex; align-items: center; gap: 6px; border-radius: 999px; padding: 9px 16px;
  font-size: 15px; font-weight: 800; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; border: 1px solid #fff; }
.dot.good { background: #51cf66; } .dot.none { background: #868e96; }
.dot.bad { background: #ff6b6b; } .dot.wait { background: #fcc419; }
.progress { position: relative; height: 22px; border-radius: 8px; background: #25262b; overflow: hidden; margin: 8px 0; }
.progress .bar { position: absolute; inset: 0 auto 0 0; background: ${HOT}; transition: width .3s; }
.progress span { position: relative; font-size: 12px; font-weight: 800; padding-left: 8px; line-height: 22px;
  text-shadow: 0 1px 2px rgba(0,0,0,.6); }
.tagbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; flex-wrap: wrap;
  max-width: calc(100vw - 32px); }
.tagbar select { width: 200px; } .tagbar input { width: 160px; }
.tagname { font-size: 14px; white-space: nowrap; }
.tagname b { font-weight: 800; color: #ffa94d; }
.saved { padding: 5px 10px; border-radius: 999px; font-weight: 800; font-size: 12px; }
.tagpill { border-radius: 999px; padding: 7px 16px; font-size: 14px; font-weight: 800; }
/* docked: inside civitai's bottom ad slot, in its flow */
:host([data-mode="docked"]) .dock { display: flex; justify-content: center; padding: 8px 16px; }
/* floating: no ad slot, bottom left, clear of the card at the bottom right */
:host([data-mode="floating"]) .dock { position: fixed; left: 18px; bottom: 18px; z-index: 2147483000;
  max-width: calc(100vw - 380px); }
`;

// lives inside the shadow root, so civitai css never reaches it and it never reaches civitai
export const CARD_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, sans-serif; }
.wrap { position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; }
.card {
  width: 300px; padding: 12px; border-radius: 10px;
  background: #1a1b1e; color: #e6e6e6; border: 1px solid #373a40;
  box-shadow: 0 8px 24px rgba(0,0,0,.45); font-size: 13px; line-height: 1.35;
}
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.brand { font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #909296; }
.title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { color: #909296; font-size: 12px; margin-bottom: 8px; }
p { margin: 6px 0; }
.muted { color: #909296; }
.error { color: #ff6b6b; word-break: break-word; }
.good-text { color: #51cf66; font-weight: 600; }
.folder { display: grid; gap: 6px; margin: 8px 0; }
label { display: grid; gap: 2px; font-size: 11px; color: #909296; }
select, input {
  width: 100%; padding: 5px 7px; border-radius: 6px; font-size: 13px;
  background: #25262b; color: #e6e6e6; border: 1px solid #373a40;
}
.actions { display: flex; gap: 6px; margin-top: 8px; }
button {
  cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 13px;
  background: #2c2e33; color: #e6e6e6; border: 1px solid #373a40;
}
button:disabled { opacity: .5; cursor: default; }
button.primary { flex: 1; background: #1971c2; border-color: #1971c2; font-weight: 600; }
button.icon { padding: 0 8px; background: none; border: none; font-size: 16px; color: #909296; }
button.link { background: none; border: none; color: #4dabf7; padding: 0 0 0 6px; }
.server { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #373a40; }
.row { display: flex; gap: 6px; }
.row input { flex: 1; min-width: 0; }
button.icon.on { color: #4dabf7; }
.pill { display: flex; align-items: center; gap: 6px; border-radius: 999px; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.good { background: #51cf66; } .dot.none { background: #909296; }
.dot.bad { background: #ff6b6b; } .dot.wait { background: #fcc419; }
.progress { position: relative; height: 18px; border-radius: 6px; background: #25262b; overflow: hidden; margin: 6px 0; }
.progress .bar { position: absolute; inset: 0 auto 0 0; background: #1971c2; transition: width .3s; }
.progress span { position: relative; font-size: 11px; padding-left: 6px; line-height: 18px; }
`;

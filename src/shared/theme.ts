// the loud look (agent/spec.md "look"). the pulse animates only the opacity
// of a ::after halo layer: compositor work, no layout or paint per frame
export const HOT = "linear-gradient(135deg, #ff1744 0%, #ff5722 45%, #ff9100 75%, #ffd600 100%)";
export const COOL = "linear-gradient(135deg, #00c853 0%, #00bfa5 55%, #00b0ff 100%)";
export const DANGER = "linear-gradient(135deg, #b71c1c 0%, #e53935 100%)";

const HOT_HALO = "0 0 7px 2px rgba(255, 23, 68, 0.8), 0 0 14px 4px rgba(255, 145, 0, 0.4)";
const COOL_HALO = "0 0 6px 2px rgba(0, 200, 83, 0.75), 0 0 12px 3px rgba(0, 176, 255, 0.35)";

/** `sel` gets the gradient, a white edge and the pulsing halo */
function glow(sel: string, gradient: string, halo: string): string {
  return `
${sel} { position: relative; background: ${gradient} !important; color: #fff !important;
  border: 1px solid rgba(255,255,255,.75) !important; text-shadow: 0 1px 2px rgba(0,0,0,.45); isolation: isolate; }
${sel}::after { content: ""; position: absolute; inset: -2px; border-radius: inherit; box-shadow: ${halo};
  opacity: .3; animation: lmf-pulse 1.8s ease-in-out infinite; pointer-events: none; will-change: opacity; z-index: -1; }`;
}

export const GLOW_CSS = `
@keyframes lmf-pulse { 0%, 100% { opacity: .2; } 50% { opacity: .7; } }
${glow(".lmf-hot", HOT, HOT_HALO)}
${glow(".lmf-cool", COOL, COOL_HALO)}
${glow(".lmf-danger", DANGER, HOT_HALO)}
@media (prefers-reduced-motion: reduce) { .lmf-hot::after, .lmf-cool::after, .lmf-danger::after { animation: none; opacity: .5; } }
`;

/** listing chips: in civitai's document (tiles) and in the model page row's shadow root */
export const CHIP_CSS = `
/* below the badge row civitai draws along the top of each card: one chip per base model */
.lmf-chips { position: absolute !important; top: 44px; left: 8px; z-index: 30; display: flex; flex-direction: column;
  align-items: flex-start; gap: 4px; max-width: calc(100% - 16px); }
/* glass chips: the illustration shows through; one real button acts (agent/spec.md "listing cards") */
/* the model page's chips sit on its showcase image, which has no badge row to clear */
.lmf-chips.lmf-hero { top: 12px; left: 12px; }
.lmf-chip { position: relative; display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
  height: 26px; box-sizing: border-box; padding: 0 9px 0 3px; border-radius: 999px;
  font: 700 12px/16px system-ui, -apple-system, sans-serif; letter-spacing: .02em;
  cursor: default; user-select: none; white-space: nowrap; }
.lmf-chip.lmf-hot, .lmf-chip.lmf-cool, .lmf-chip.lmf-danger, .lmf-chip.lmf-more {
  background: rgba(12, 12, 15, .38) !important; color: rgba(255,255,255,.92) !important;
  border: 1px solid rgba(255,255,255,.28) !important; text-shadow: 0 1px 2px rgba(0,0,0,.85); }
.lmf-chip::after { display: none; }
.lmf-chip.lmf-cool, .lmf-chip.lmf-busy, .lmf-chip.lmf-more { padding-left: 9px; }
/* a static state dot, never blinking: have, downloading, failed; install chips have none */
.lmf-chip.lmf-cool::before, .lmf-chip.lmf-busy::before, .lmf-chip.lmf-danger::before {
  content: ""; flex: none; width: 7px; height: 7px; border-radius: 50%; }
.lmf-chip.lmf-cool::before { background: #51cf66; }
.lmf-chip.lmf-busy::before { background: #ff9100; }
.lmf-chip.lmf-danger::before { background: #ff1744; }
.lmf-chip.lmf-busy { cursor: progress; }
.lmf-label { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
/* the one thing that acts */
.lmf-get { flex: none; height: 20px; padding: 0 11px; border-radius: 999px; border: 1px solid rgba(255,255,255,.85);
  background: ${HOT}; color: #fff; font: 800 11px/18px system-ui, -apple-system, sans-serif; letter-spacing: .03em;
  cursor: pointer; text-shadow: 0 1px 1px rgba(0,0,0,.35); box-shadow: 0 1px 4px rgba(0,0,0,.5); }
.lmf-get:hover { filter: brightness(1.15); }
.lmf-chip.lmf-danger .lmf-get { background: #c92a2a; }
/* the target reads as one path, "loras / anima/styles": same size, one color per half, each half clickable */
.lmf-target { display: inline-flex; align-items: baseline; gap: 3px; min-width: 0; }
.lmf-root, .lmf-sub { cursor: pointer; font-size: 12px; border-radius: 3px; padding: 0 1px; }
.lmf-root { flex: none; color: #ffc078; font-weight: 800; }
.lmf-sub { color: #a5d8ff; font-weight: 700; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.lmf-slash { color: rgba(255,255,255,.5); font-weight: 400; }
.lmf-root:hover, .lmf-sub:hover { text-decoration: underline; text-underline-offset: 2px; background: rgba(0,0,0,.35); }
`;

/** injected once into civitai's own document for the listing overlays */
export const PAGE_CSS = `
${GLOW_CSS}
${CHIP_CSS}
.lmf-tip { position: fixed; z-index: 2147483600; max-width: 420px; padding: 7px 10px; border-radius: 8px; pointer-events: none;
  background: #1f2023; color: #f1f3f5; border: 1px solid #5c5f66; box-shadow: 0 10px 30px rgba(0,0,0,.65);
  font: 500 12px/1.4 system-ui, -apple-system, sans-serif; white-space: pre-wrap; word-break: break-all; }
.lmf-tip-head { font-weight: 800; margin-bottom: 3px; }
.lmf-tip-muted { color: #adb5bd; }
.lmf-tip-hot { margin-top: 4px; font-weight: 800; color: #ffa94d; }
.lmf-tip-cool { margin-top: 4px; font-weight: 700; color: #69db7c; }
.lmf-tip-bad { font-weight: 800; color: #ff8787; }
/* ads: a red ring and a label so the removal is visible, then out (compositor only: opacity, transform) */
.lmf-ad-kill { position: relative !important; overflow: hidden !important; outline: 3px solid #ff1744 !important;
  outline-offset: -3px; box-shadow: inset 0 0 24px 6px rgba(255, 23, 68, .7) !important;
  animation: lmf-ad-out 1.4s ease-in forwards; transform-origin: center; }
.lmf-ad-kill::before { content: "✕ ad removed"; position: absolute; z-index: 2; top: 50%; left: 50%;
  transform: translate(-50%, -50%); padding: 4px 12px; border-radius: 999px; background: ${HOT}; color: #fff;
  font: 800 13px/18px system-ui, -apple-system, sans-serif; border: 2px solid #fff; white-space: nowrap; }
@keyframes lmf-ad-out { 0%, 45% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(.9); } }
.lmf-ad-gone { display: none !important; }
/* docked strips: their own rows in civitai's header/content flex column */
#lmf-tagbar-host, #lora-manager-free-card { flex: none; position: relative; z-index: 198; }
`;

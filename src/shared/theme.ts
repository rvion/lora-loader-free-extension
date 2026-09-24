// the loud look (agent/spec.md "look"). the pulse animates only the opacity
// of a ::after halo layer: compositor work, no layout or paint per frame
export const HOT = "linear-gradient(135deg, #ff1744 0%, #ff5722 45%, #ff9100 75%, #ffd600 100%)";
export const COOL = "linear-gradient(135deg, #00c853 0%, #00bfa5 55%, #00b0ff 100%)";
export const DANGER = "linear-gradient(135deg, #b71c1c 0%, #e53935 100%)";

const HOT_HALO = "0 0 12px 3px rgba(255, 23, 68, 0.9), 0 0 26px 8px rgba(255, 145, 0, 0.55)";
const COOL_HALO = "0 0 10px 3px rgba(0, 200, 83, 0.85), 0 0 22px 6px rgba(0, 176, 255, 0.45)";

/** `sel` gets the gradient, a white edge and the pulsing halo */
function glow(sel: string, gradient: string, halo: string): string {
  return `
${sel} { position: relative; background: ${gradient} !important; color: #fff !important;
  border: 2px solid rgba(255,255,255,.9) !important; text-shadow: 0 1px 2px rgba(0,0,0,.45); isolation: isolate; }
${sel}::after { content: ""; position: absolute; inset: -3px; border-radius: inherit; box-shadow: ${halo};
  opacity: .35; animation: lmf-pulse 1.4s ease-in-out infinite; pointer-events: none; will-change: opacity; z-index: -1; }`;
}

export const GLOW_CSS = `
@keyframes lmf-pulse { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }
${glow(".lmf-hot", HOT, HOT_HALO)}
${glow(".lmf-cool", COOL, COOL_HALO)}
${glow(".lmf-danger", DANGER, HOT_HALO)}
@media (prefers-reduced-motion: reduce) { .lmf-hot::after, .lmf-cool::after, .lmf-danger::after { animation: none; opacity: .8; } }
`;

/** injected once into civitai's own document for the listing overlays */
export const PAGE_CSS = `
${GLOW_CSS}
/* below the badge row civitai draws along the top of each card */
.lmf-chip { position: absolute !important; top: 44px; left: 8px; z-index: 30; display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 999px; font: 800 12px/16px system-ui, -apple-system, sans-serif; letter-spacing: .02em;
  cursor: default; user-select: none; }
.lmf-chip.lmf-hot, .lmf-chip.lmf-danger { cursor: pointer; }
.lmf-chip.lmf-hot:hover { transform: scale(1.08); }
.lmf-chip.lmf-busy { cursor: progress; }
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
#lmf-tagbar-host, #lora-manager-free-card { flex: none; }
`;

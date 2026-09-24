import { CARD_CSS } from "src/content/cardCss.ts";

export const TAG_HOST_ID = "lmf-tagbar-host";
const AD_SLOT = "[data-adhesive-ad]";

/** the tag bar's own shadow host: it moves between civitai's ad slot and the document root */
export function createTagHost(): { host: HTMLElement; mountPoint: HTMLElement } {
  const host = document.createElement("div");
  host.id = TAG_HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  const mountPoint = document.createElement("div");
  mountPoint.className = "dock";
  shadow.append(style, mountPoint);
  return { host, mountPoint };
}

/** idempotent, cheap enough for the 500 ms url tick: moves the host only when its place changed */
export function placeTagBar(host: HTMLElement, onTagPage: boolean): void {
  if (!onTagPage) {
    host.remove();
    return;
  }
  const slot = document.querySelector(AD_SLOT);
  const parent = slot ?? document.documentElement;
  const mode = slot != null ? "docked" : "floating";
  if (host.parentElement !== parent) parent.appendChild(host);
  if (host.dataset.mode !== mode) host.dataset.mode = mode;
}

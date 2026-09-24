import { CARD_CSS } from "src/content/cardCss.ts";

export const CARD_HOST_ID = "lora-manager-free-card";
export const TAG_HOST_ID = "lmf-tagbar-host";
/** civitai's desktop right rail on model pages. its class is a css module name with a build hash */
export const RAIL_SLOT = '[class*="-module__"][class*="__rail"]';
/** civitai's bottom ad bar */
export const AD_BAR_SLOT = "[data-adhesive-ad]";

export type HostMode = "docked" | "floating" | "custom";

/** a shadow host with the overlay css, and the element react mounts into */
export function createHost(
  id: string,
  mountClass: string,
): { host: HTMLElement; mountPoint: HTMLElement } {
  const host = document.createElement("div");
  host.id = id;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  const mountPoint = document.createElement("div");
  mountPoint.className = mountClass;
  shadow.append(style, mountPoint);
  return { host, mountPoint };
}

export type Placement = {
  visible: boolean;
  /** where to dock, when civitai rendered it */
  slotSelector: string;
  /** a user chosen spot beats docking */
  custom: boolean;
};

/** idempotent, cheap enough for the 500 ms url tick: moves the host only when its place changed */
export function placeHost(host: HTMLElement, p: Placement): void {
  if (!p.visible) {
    host.remove();
    return;
  }
  const slot = p.custom ? null : document.querySelector(p.slotSelector);
  const parent = slot ?? document.documentElement;
  const mode: HostMode = slot != null ? "docked" : p.custom ? "custom" : "floating";
  if (host.parentElement !== parent) parent.appendChild(host);
  if (host.dataset.mode !== mode) host.dataset.mode = mode;
}

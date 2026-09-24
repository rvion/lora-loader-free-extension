import { CARD_CSS } from "src/content/cardCss.ts";

export const TAG_HOST_ID = "lmf-tagbar-host";

export type DockTarget = {
  selector: string;
  /** append inside the match, or insert right after it */
  how: "append" | "after";
};

/** civitai's desktop right rail on model pages. its class is a css module name with a build hash */
export const RAIL_DOCK: DockTarget = {
  selector: '[class*="-module__"][class*="__rail"]',
  how: "append",
};
/** right under civitai's header: header and content are siblings in a flex column */
export const UNDER_HEADER_DOCK: DockTarget = { selector: "#main header", how: "after" };

export type HostMode = "docked" | "floating" | "custom" | "hidden";

/** a shadow host with the overlay css, and the element react mounts into */
export function createHost(id: string): { host: HTMLElement; mountPoint: HTMLElement } {
  const host = document.createElement("div");
  host.id = id;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CARD_CSS;
  const mountPoint = document.createElement("div");
  shadow.append(style, mountPoint);
  // civitai's page hotkeys ("/" jumps to its search) see our shadow host, not our input, as the
  // target, so they fire while typing here. keys from our fields stop at the host; react already
  // handled them inside the shadow root
  for (const type of ["keydown", "keypress", "keyup"] as const)
    host.addEventListener(type, (e) => {
      if (isTypingTarget(e.composedPath()[0])) e.stopPropagation();
    });
  return { host, mountPoint };
}

function isTypingTarget(t: EventTarget | undefined): boolean {
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  );
}

export type Placement = {
  visible: boolean;
  dock: DockTarget;
  /** free mode: never docks */
  free: boolean;
  /** free spot chosen by a drag */
  hasPos: boolean;
};

/** idempotent, cheap enough for the 500 ms url tick: touches the dom only when the place changed */
export function placeHost(host: HTMLElement, p: Placement): HostMode {
  if (!p.visible) {
    host.remove();
    return "hidden";
  }
  const anchor = p.free ? null : document.querySelector(p.dock.selector);
  let mode: HostMode;
  if (anchor != null) {
    mode = "docked";
    if (p.dock.how === "append") {
      if (host.parentElement !== anchor) anchor.appendChild(host);
    } else if (!inRunAfter(anchor, host)) {
      anchor.insertAdjacentElement("afterend", host);
    }
  } else {
    mode = p.hasPos ? "custom" : "floating";
    if (host.parentElement !== document.documentElement) document.documentElement.appendChild(host);
  }
  if (host.dataset.mode !== mode) host.dataset.mode = mode;
  return mode;
}

const OUR_HOSTS = new Set([TAG_HOST_ID]);

/** true when host sits in the run of our hosts right after anchor: two docked hosts never swap forever */
function inRunAfter(anchor: Element, host: HTMLElement): boolean {
  for (
    let el = anchor.nextElementSibling;
    el != null && OUR_HOSTS.has(el.id);
    el = el.nextElementSibling
  )
    if (el === host) return true;
  return false;
}

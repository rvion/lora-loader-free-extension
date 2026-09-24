import { makeObservable } from "mobx";

const KILL = "lmf-ad-kill";
const GONE = "lmf-ad-gone";
const DEBOUNCE_MS = 300;
/** a fallback when animationend never fires (display none parent, reduced motion) */
const GONE_AFTER_MS = 1600;

/** removes civitai's ads, visibly (agent/spec.md "ads"). plain dom, nothing observable */
export class AdSvc {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private observer: MutationObserver;

  constructor() {
    makeObservable(this, {});
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.schedule();
  }

  dispose(): void {
    this.observer.disconnect();
    if (this.timer != null) clearTimeout(this.timer);
  }

  private schedule(): void {
    if (this.timer != null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.pass();
    }, DEBOUNCE_MS);
  }

  private pass(): void {
    for (const el of adContainers()) {
      if (el.classList.contains(KILL) || el.classList.contains(GONE)) continue;
      el.classList.add(KILL);
      const hide = () => {
        el.classList.remove(KILL);
        el.classList.add(GONE);
      };
      el.addEventListener("animationend", hide, { once: true });
      setTimeout(hide, GONE_AFTER_MS);
    }
  }
}

function adContainers(): Set<HTMLElement> {
  const out = new Set<HTMLElement>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-adhesive-ad]")) out.add(el);
  for (const link of document.querySelectorAll('a[aria-label="visit advertiser"]')) {
    const box =
      link.closest<HTMLElement>("[data-adhesive-ad]") ??
      link.closest<HTMLElement>('[class*="-module__"][class*="__rail"]') ??
      link.closest<HTMLElement>(".box-content");
    if (box != null) out.add(box);
  }
  return out;
}

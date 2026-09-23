import { makeObservable } from "mobx";

import { modelIdFromHref } from "src/shared/civitai.ts";
import type { LibraryBatch } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";

type Presence = LibraryBatch[string];

const BADGE_ATTR = "data-lmf-badge";
const DEBOUNCE_MS = 300;
/** keeps the query string of check-models-exist well under url limits */
const CHUNK = 100;
/** civitai mutates its dom constantly: without this, an unreachable LM gets a call every pass */
const DOWN_BACKOFF_MS = 30_000;

/** green "in library" badges on every civitai model card. plain dom, no ui state, so nothing here is observable */
export class BadgeSvc {
  /** null = checked and absent */
  private known = new Map<number, Presence | null>();
  private inflight = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryAfter = 0;
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

  forget(modelId: number): void {
    this.known.delete(modelId);
    this.schedule();
  }

  forgetAll(): void {
    this.known.clear();
    this.retryAfter = 0;
    this.schedule();
  }

  private schedule(): void {
    if (this.timer != null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.pass();
    }, DEBOUNCE_MS);
  }

  private async pass(): Promise<void> {
    const missing = unknownIds(modelCards(), this.known, this.inflight);
    if (missing.length > 0 && Date.now() >= this.retryAfter) {
      await Promise.all(chunk(missing, CHUNK).map((ids) => this.fetch(ids)));
    }
    this.render(modelCards());
  }

  private async fetch(ids: number[]): Promise<void> {
    for (const id of ids) this.inflight.add(id);
    try {
      const found = await send({ kind: "libraryBatch", modelIds: ids });
      for (const id of ids) this.known.set(id, found[String(id)] ?? null);
    } catch (e) {
      this.retryAfter = Date.now() + DOWN_BACKOFF_MS;
      console.warn("[lm-free] badges paused 30 s:", e instanceof Error ? e.message : e);
    } finally {
      for (const id of ids) this.inflight.delete(id);
    }
  }

  /** idempotent: touches the dom only where a badge is missing, stale or unwanted, so it never feeds the observer a loop */
  private render(cards: ModelCard[]): void {
    for (const c of cards) {
      const presence = this.known.get(c.modelId);
      const existing = c.el.querySelector<HTMLElement>(`:scope > [${BADGE_ATTR}]`);
      if (presence == null) {
        existing?.remove();
        continue;
      }
      const text = badgeText(presence);
      if (existing != null) {
        if (existing.textContent !== text) existing.textContent = text;
        continue;
      }
      if (getComputedStyle(c.el).position === "static") c.el.style.position = "relative";
      c.el.appendChild(makeBadge(text, presence.modelType));
    }
  }
}

type ModelCard = { el: HTMLAnchorElement; modelId: number };

/** a link to a model that holds media is a card; a text link in a description is not */
function modelCards(): ModelCard[] {
  const out: ModelCard[] = [];
  for (const el of document.querySelectorAll<HTMLAnchorElement>('a[href*="/models/"]')) {
    const modelId = modelIdFromHref(el.getAttribute("href") ?? "");
    if (modelId != null && el.querySelector("img, video") != null) out.push({ el, modelId });
  }
  return out;
}

export function unknownIds(
  cards: { modelId: number }[],
  known: ReadonlyMap<number, unknown>,
  inflight: ReadonlySet<number>,
): number[] {
  const ids = new Set<number>();
  for (const c of cards) if (!known.has(c.modelId) && !inflight.has(c.modelId)) ids.add(c.modelId);
  return [...ids];
}

export function chunk<T>(xs: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

export function badgeText(p: Presence): string {
  return p.versionCount > 1 ? `✓ LM ×${p.versionCount}` : "✓ LM";
}

function makeBadge(text: string, modelType: string): HTMLElement {
  const b = document.createElement("span");
  b.setAttribute(BADGE_ATTR, "");
  b.title = `In your LoRA Manager library (${modelType})`;
  b.textContent = text;
  Object.assign(b.style, {
    position: "absolute",
    top: "6px",
    left: "6px",
    zIndex: "20",
    padding: "2px 7px",
    borderRadius: "999px",
    background: "#2b8a3e",
    color: "#fff",
    font: "600 11px/16px system-ui, -apple-system, sans-serif",
    boxShadow: "0 1px 4px rgba(0,0,0,.5)",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  return b;
}

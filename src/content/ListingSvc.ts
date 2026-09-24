import { makeObservable } from "mobx";

import {
  fetchCivitaiModel,
  lmPrefixForCivitaiType,
  modelIdFromHref,
  parsePageTag,
  weightFiles,
} from "src/shared/civitai.ts";
import { suggestFolder } from "src/shared/folderRules.ts";
import type { LibraryBatch } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { PAGE_CSS } from "src/shared/theme.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

type Presence = LibraryBatch[string];

const CHIP_ATTR = "data-lmf-chip";
const DEBOUNCE_MS = 300;
/** keeps the query string of check-models-exist well under url limits */
const CHUNK = 100;
/** civitai mutates its dom constantly: without this, an unreachable LM gets a call every pass */
const DOWN_BACKOFF_MS = 30_000;

export type Chip = {
  cls: "lmf-cool" | "lmf-hot" | "lmf-danger" | "lmf-hot lmf-busy";
  text: string;
  title: string;
};

/** the overlay on every civitai model card: ✓ in library, ⬇ install, progress. plain dom, nothing observable */
export class ListingSvc {
  /** null = checked and absent */
  private known = new Map<number, Presence | null>();
  private jobs = new Map<number, DownloadState>();
  private inflight = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryAfter = 0;
  private observer: MutationObserver;

  constructor() {
    makeObservable(this, {});
    injectPageCss();
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
    this.render();
  }

  private async fetch(ids: number[]): Promise<void> {
    for (const id of ids) this.inflight.add(id);
    try {
      const found = await send({ kind: "libraryBatch", modelIds: ids });
      for (const id of ids) this.known.set(id, found[String(id)] ?? null);
    } catch (e) {
      this.retryAfter = Date.now() + DOWN_BACKOFF_MS;
      console.warn("[lm-free] listing badges paused 30 s:", errorMessage(e));
    } finally {
      for (const id of ids) this.inflight.delete(id);
    }
  }

  /** idempotent: writes only where a chip is missing or stale, so it never feeds the observer a loop */
  private render(): void {
    for (const c of modelCards()) {
      const presence = this.known.has(c.modelId) ? (this.known.get(c.modelId) ?? null) : undefined;
      const want = chipFor(presence, this.jobs.get(c.modelId));
      const existing = c.el.querySelector<HTMLElement>(`:scope > [${CHIP_ATTR}]`);
      if (want == null) {
        existing?.remove();
        continue;
      }
      const chip = existing ?? this.makeChip(c.el, c.modelId);
      const cls = `lmf-chip ${want.cls}`;
      if (chip.className !== cls) chip.className = cls;
      if (chip.textContent !== want.text) chip.textContent = want.text;
      if (chip.title !== want.title) chip.title = want.title;
    }
  }

  private makeChip(card: HTMLAnchorElement, modelId: number): HTMLElement {
    if (getComputedStyle(card).position === "static") card.style.position = "relative";
    const chip = document.createElement("span");
    chip.setAttribute(CHIP_ATTR, String(modelId));
    chip.setAttribute("role", "button");
    // the chip sits inside civitai's <a>: swallow the whole gesture so the card never navigates
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    chip.addEventListener("pointerdown", swallow);
    chip.addEventListener("mousedown", swallow);
    chip.addEventListener("click", (e) => {
      swallow(e);
      void this.install(modelId);
    });
    card.appendChild(chip);
    return chip;
  }

  private setJob(modelId: number, s: DownloadState): void {
    if (s.kind === "done") {
      this.jobs.delete(modelId);
      this.known.delete(modelId);
    } else {
      this.jobs.set(modelId, s);
    }
    this.schedule();
  }

  async install(modelId: number): Promise<void> {
    const job = this.jobs.get(modelId);
    if (job != null && job.kind !== "failed") return;
    if (this.known.get(modelId) != null) return;
    this.setJob(modelId, { kind: "starting" });
    try {
      const m = await fetchCivitaiModel(location.origin, modelId);
      const prefix = lmPrefixForCivitaiType(m.type);
      if (prefix == null) throw new Error(`Civitai type ${m.type} is not handled`);
      const v = m.versions[0];
      if (v == null) throw new Error("this model has no version");
      const folder = await suggestFolder(prefix, m.tags, parsePageTag(location.href));
      if (folder.pick.root === "") throw new Error(`LoRA Manager has no ${prefix} root`);
      const r = await send({
        kind: "startDownload",
        target: {
          modelId,
          versionId: v.id,
          prefix,
          folder: folder.pick,
          fileId: weightFiles(v)[0]?.id ?? null,
        },
      });
      watchDownload({
        modelId,
        versionId: v.id,
        downloadId: r.downloadId,
        isAlive: () => true,
        onState: (s) => this.setJob(modelId, s),
      });
    } catch (e) {
      this.setJob(modelId, { kind: "failed", message: errorMessage(e) });
    }
  }
}

/** undefined presence = not answered yet: no chip rather than a guess */
export function chipFor(
  presence: Presence | null | undefined,
  job: DownloadState | undefined,
): Chip | null {
  if (job != null && job.kind !== "idle" && job.kind !== "done") {
    if (job.kind === "failed")
      return { cls: "lmf-danger", text: "✕ failed", title: `${job.message} (click to retry)` };
    if (job.kind === "starting") return { cls: "lmf-hot lmf-busy", text: "⬇ …", title: "starting" };
    const text = job.stage ?? `${Math.round(job.percent)}%`;
    return { cls: "lmf-hot lmf-busy", text: `⬇ ${text}`, title: "downloading into LoRA Manager" };
  }
  if (presence === undefined) return null;
  if (presence == null)
    return {
      cls: "lmf-hot",
      text: "⬇ Install",
      title: "Install into LoRA Manager (latest version)",
    };
  return {
    cls: "lmf-cool",
    text: presence.versionCount > 1 ? `✓ LM ×${presence.versionCount}` : "✓ LM",
    title: [`In your LoRA Manager library (${presence.modelType}):`, ...presence.fileNames].join(
      "\n",
    ),
  };
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

function injectPageCss(): void {
  if (document.getElementById("lmf-page-css") != null) return;
  const style = document.createElement("style");
  style.id = "lmf-page-css";
  style.textContent = PAGE_CSS;
  document.head.appendChild(style);
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

import { makeObservable } from "mobx";

import {
  fetchCivitaiModel,
  fetchCivitaiModels,
  lmPrefixForCivitaiType,
  modelIdFromHref,
  newerVersion,
  parsePageTag,
  weightFiles,
  type CivitaiModel,
  type CivitaiVersion,
  type LmPrefix,
} from "src/shared/civitai.ts";
import { suggestFolder } from "src/shared/folderRules.ts";
import type { LibraryBatch } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { whereInLibrary } from "src/shared/paths.ts";
import { PAGE_CSS } from "src/shared/theme.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

type Presence = LibraryBatch[string];

const CHIP_ATTR = "data-lmf-chip";
const DEBOUNCE_MS = 300;
/** keeps the query strings of check-models-exist and civitai's models?ids= under their limits */
const CHUNK = 100;
/** civitai mutates its dom constantly: without this, an unreachable LM gets a call every pass */
const DOWN_BACKOFF_MS = 30_000;

export type Chip = {
  cls: "lmf-cool" | "lmf-hot" | "lmf-danger" | "lmf-hot lmf-busy";
  text: string;
};

/** the overlay on every civitai model card: ✓ in library, ⬆ newer, ⬇ install, progress. plain dom, nothing observable */
export class ListingSvc {
  /** null = checked and absent */
  private known = new Map<number, Presence | null>();
  /** civitai's view of models we have, for newer versions. null = civitai did not answer */
  private remote = new Map<number, CivitaiModel | null>();
  private jobs = new Map<number, DownloadState>();
  private inflight = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryAfter = 0;
  private observer: MutationObserver;
  private tip = new Tip();

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
    this.tip.forget(modelId);
    this.schedule();
  }

  forgetAll(): void {
    this.known.clear();
    this.remote.clear();
    this.tip.forgetAll();
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
    const owned = [...this.known].flatMap(([id, p]) =>
      p != null && !this.remote.has(id) ? [id] : [],
    );
    if (owned.length > 0)
      await Promise.all(chunk(owned, CHUNK).map((ids) => this.fetchRemote(ids)));
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

  private async fetchRemote(ids: number[]): Promise<void> {
    for (const id of ids) this.remote.set(id, null);
    try {
      const models = await fetchCivitaiModels(location.origin, ids);
      for (const [id, m] of models) this.remote.set(id, m);
    } catch (e) {
      console.warn("[lm-free] newer version check skipped:", errorMessage(e));
    }
  }

  private newerFor(modelId: number): CivitaiVersion | null {
    const p = this.known.get(modelId);
    const m = this.remote.get(modelId);
    if (p == null || m == null) return null;
    return newerVersion(
      m.versions,
      p.versions.map((v) => v.versionId),
    );
  }

  /** idempotent: writes only where a chip is missing or stale, so it never feeds the observer a loop */
  private render(): void {
    for (const c of modelCards()) {
      const presence = this.known.has(c.modelId) ? (this.known.get(c.modelId) ?? null) : undefined;
      const want = chipFor(presence, this.jobs.get(c.modelId), this.newerFor(c.modelId));
      const existing = c.el.querySelector<HTMLElement>(`:scope > [${CHIP_ATTR}]`);
      if (want == null) {
        existing?.remove();
        continue;
      }
      const chip = existing ?? this.makeChip(c.el, c.modelId);
      const cls = `lmf-chip ${want.cls}`;
      if (chip.className !== cls) chip.className = cls;
      if (chip.textContent !== want.text) chip.textContent = want.text;
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
      void this.onChipClick(modelId);
    });
    chip.addEventListener("pointerenter", () => this.tip.show(chip, this.tipInput(modelId)));
    chip.addEventListener("pointerleave", () => this.tip.hide());
    card.appendChild(chip);
    return chip;
  }

  private tipInput(modelId: number): TipInput {
    return {
      modelId,
      presence: this.known.get(modelId) ?? null,
      remote: this.remote.get(modelId) ?? null,
      newer: this.newerFor(modelId),
      job: this.jobs.get(modelId) ?? null,
    };
  }

  private onChipClick(modelId: number): Promise<void> {
    const newer = this.newerFor(modelId);
    if (newer != null) return this.install(modelId, newer.id);
    if (this.known.get(modelId) != null) return Promise.resolve();
    return this.install(modelId, null);
  }

  private setJob(modelId: number, s: DownloadState): void {
    if (s.kind === "done") {
      this.jobs.delete(modelId);
      this.known.delete(modelId);
      this.tip.forget(modelId);
    } else {
      this.jobs.set(modelId, s);
    }
    this.schedule();
  }

  /** versionId null: civitai's default (first listed) version */
  async install(modelId: number, versionId: number | null): Promise<void> {
    const job = this.jobs.get(modelId);
    if (job != null && job.kind !== "failed") return;
    this.setJob(modelId, { kind: "starting" });
    try {
      const m = await fetchCivitaiModel(location.origin, modelId);
      const prefix = lmPrefixForCivitaiType(m.type);
      if (prefix == null) throw new Error(`Civitai type ${m.type} is not handled`);
      const v = versionId != null ? m.versions.find((x) => x.id === versionId) : m.versions[0];
      if (v == null) throw new Error("this model has no such version");
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
  newer: CivitaiVersion | null = null,
): Chip | null {
  if (job != null && job.kind !== "idle" && job.kind !== "done") {
    if (job.kind === "failed") return { cls: "lmf-danger", text: "✕ failed" };
    if (job.kind === "starting") return { cls: "lmf-hot lmf-busy", text: "⬇ …" };
    return { cls: "lmf-hot lmf-busy", text: `⬇ ${job.stage ?? `${Math.round(job.percent)}%`}` };
  }
  if (presence === undefined) return null;
  if (presence == null) return { cls: "lmf-hot", text: "⬇ Install" };
  if (newer != null) return { cls: "lmf-hot", text: "⬆ NEWER VERSION" };
  const n = presence.versions.length;
  return { cls: "lmf-cool", text: n > 1 ? `✓ LM ×${n}` : "✓ LM" };
}

export type TipInput = {
  modelId: number;
  presence: Presence | null;
  remote: CivitaiModel | null;
  newer: CivitaiVersion | null;
  job: DownloadState | null;
};

const PREFIX_BY_LM_TYPE: Record<string, LmPrefix> = {
  lora: "loras",
  checkpoint: "checkpoints",
  embedding: "embeddings",
};

/** one shared tooltip element for every chip. paths are fetched on first hover of a model, then cached */
class Tip {
  private el: HTMLElement | null = null;
  private anchor: HTMLElement | null = null;
  private paths = new Map<number, Map<number, string[]>>();
  private roots = new Map<LmPrefix, string[]>();

  forget(modelId: number): void {
    this.paths.delete(modelId);
  }

  forgetAll(): void {
    this.paths.clear();
    this.roots.clear();
  }

  show(anchor: HTMLElement, p: TipInput): void {
    this.anchor = anchor;
    this.render(p);
    if (p.presence != null && !this.paths.has(p.modelId)) void this.loadPaths(p);
  }

  hide(): void {
    this.anchor = null;
    this.el?.remove();
  }

  private async loadPaths(p: TipInput): Promise<void> {
    const presence = p.presence;
    if (presence == null) return;
    const byVersion = new Map<number, string[]>();
    this.paths.set(p.modelId, byVersion);
    try {
      const prefix = PREFIX_BY_LM_TYPE[presence.modelType];
      if (prefix != null && !this.roots.has(prefix))
        this.roots.set(prefix, (await send({ kind: "folderChoices", prefix })).roots);
      const roots = prefix != null ? (this.roots.get(prefix) ?? []) : [];
      await Promise.all(
        presence.versions.map(async (v) => {
          const s = await send({
            kind: "libraryStatus",
            modelId: p.modelId,
            versionId: v.versionId,
          });
          if (!s.exists) return;
          byVersion.set(
            v.versionId,
            s.files.map((f) => {
              const w = whereInLibrary(f.filePath, roots);
              return `${w.rootName}${w.dir !== "" ? ` › ${w.dir}` : ""} / ${w.fileName}`;
            }),
          );
        }),
      );
    } catch (e) {
      this.paths.delete(p.modelId);
      console.warn("[lm-free] tooltip paths:", errorMessage(e));
    }
    if (this.anchor?.getAttribute(CHIP_ATTR) === String(p.modelId)) this.render(p);
  }

  private render(p: TipInput): void {
    const anchor = this.anchor;
    if (anchor == null) return;
    const el = this.el ?? document.createElement("div");
    this.el = el;
    el.className = "lmf-tip";
    el.replaceChildren(...tipLines(p, this.paths.get(p.modelId)).map(line));
    if (el.parentElement !== document.body) document.body.appendChild(el);
    const r = anchor.getBoundingClientRect();
    el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8))}px`;
    const below = r.bottom + 6;
    el.style.top = `${below + el.offsetHeight > innerHeight ? r.top - el.offsetHeight - 6 : below}px`;
  }
}

export type TipLine = { text: string; cls?: "head" | "muted" | "hot" | "cool" | "bad" };

function line(l: TipLine): HTMLElement {
  const d = document.createElement("div");
  d.textContent = l.text;
  if (l.cls != null) d.className = `lmf-tip-${l.cls}`;
  return d;
}

export function tipLines(p: TipInput, paths: Map<number, string[]> | undefined): TipLine[] {
  if (p.job?.kind === "failed")
    return [{ text: "Install failed", cls: "bad" }, { text: `${p.job.message} (click to retry)` }];
  if (p.presence == null)
    return [
      { text: "Not in your library", cls: "head" },
      { text: "Click to install the default version", cls: "muted" },
    ];
  const out: TipLine[] = [{ text: `In your library (${p.presence.modelType})`, cls: "head" }];
  for (const v of p.presence.versions) {
    const base = p.remote?.versions.find((x) => x.id === v.versionId)?.baseModel;
    out.push({ text: `${v.name}${base != null ? ` · ${base}` : ""}` });
    const where = paths?.get(v.versionId);
    if (where == null)
      out.push({ text: paths == null ? "  locating…" : `  ${v.fileName}`, cls: "muted" });
    else for (const w of where) out.push({ text: `  ${w}`, cls: "muted" });
  }
  if (p.newer != null)
    out.push({
      text: `⬆ Newer on Civitai: ${p.newer.name}${p.newer.baseModel != null ? ` · ${p.newer.baseModel}` : ""} (click to install)`,
      cls: "hot",
    });
  else if (p.remote != null) out.push({ text: "✓ Up to date", cls: "cool" });
  return out;
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

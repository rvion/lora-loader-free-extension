import { makeObservable } from "mobx";

import {
  baseGroups,
  fetchCivitaiModel,
  fetchCivitaiModels,
  hasNewer,
  lmPrefixForCivitaiType,
  modelIdFromHref,
  parsePageTag,
  weightFiles,
  type BaseGroup,
  type CivitaiModel,
  type CivitaiVersion,
  type LmPrefix,
} from "src/shared/civitai.ts";
import { resolveFolder, withDraft } from "src/shared/folderRules.ts";
import type { LibraryBatch } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { rootLabels, whereInLibrary } from "src/shared/paths.ts";
import {
  getLastFolder,
  getTagRules,
  onTagRulesChanged,
  type FolderPick,
  type TagRule,
} from "src/shared/storage.ts";
import { PAGE_CSS } from "src/shared/theme.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

type Presence = LibraryBatch[string];

const CHIPS_ATTR = "data-lmf-chips";
const DEBOUNCE_MS = 300;
/** keeps the query strings of check-models-exist and civitai's models?ids= under their limits */
const CHUNK = 100;
/** civitai mutates its dom constantly: without this, an unreachable LM gets a call every pass */
const DOWN_BACKOFF_MS = 30_000;
const MAX_BASE_CHIPS = 4;

export type Target = { root: string; rootLabel: string; sub: string };

export type Chip = {
  cls: "lmf-cool" | "lmf-hot" | "lmf-danger" | "lmf-hot lmf-busy" | "lmf-more";
  text: string;
  /** the version a click installs; null = civitai's default version; undefined = not clickable */
  install?: number | null;
  target?: Target;
};

/** the chips on every civitai model card, one per base model (agent/spec.md "listing cards"). plain dom */
export class ListingSvc {
  /** null = checked and absent */
  private known = new Map<number, Presence | null>();
  /** civitai's view of each model on screen. null = civitai did not answer */
  private remote = new Map<number, CivitaiModel | null>();
  /** install jobs by version id */
  private jobs = new Map<number, DownloadState>();
  private inflight = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryAfter = 0;
  private observer: MutationObserver;
  private tip = new Tip();
  private ctx: FolderCtx;

  /** draft: the tag bar's unsaved rule, previewed live by every chip */
  constructor(draft: () => TagRule | null) {
    makeObservable(this, {});
    injectPageCss();
    this.ctx = new FolderCtx(draft, () => this.schedule());
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.schedule();
  }

  dispose(): void {
    this.observer.disconnect();
    if (this.timer != null) clearTimeout(this.timer);
  }

  /** a rule, a draft or the last folder changed: retarget every chip */
  refresh(): void {
    this.schedule();
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
    this.ctx.forgetRoots();
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
    const onScreen = modelCards();
    const missing = unknownIds(onScreen, this.known, this.inflight);
    if (missing.length > 0 && Date.now() >= this.retryAfter) {
      await Promise.all(chunk(missing, CHUNK).map((ids) => this.fetch(ids)));
    }
    const noRemote = [...this.known.keys()].filter((id) => !this.remote.has(id));
    if (noRemote.length > 0)
      await Promise.all(chunk(noRemote, CHUNK).map((ids) => this.fetchRemote(ids)));
    this.render();
  }

  private async fetch(ids: number[]): Promise<void> {
    for (const id of ids) this.inflight.add(id);
    try {
      const found = await send({ kind: "libraryBatch", modelIds: ids });
      for (const id of ids) this.known.set(id, found[String(id)] ?? null);
    } catch (e) {
      this.retryAfter = Date.now() + DOWN_BACKOFF_MS;
      console.warn("[lm-free] listing chips paused 30 s:", errorMessage(e));
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
      console.warn("[lm-free] civitai details skipped:", errorMessage(e));
    }
  }

  private chipsOf(modelId: number): Chip[] {
    const m = this.remote.get(modelId) ?? null;
    return chipsFor({
      presence: this.known.has(modelId) ? (this.known.get(modelId) ?? null) : undefined,
      remote: m,
      jobs: this.jobs,
      target: (v) => (m == null ? null : this.ctx.target(m, v)),
    });
  }

  /** idempotent: rebuilds a card's chips only when their content changed, so it never feeds the observer a loop */
  private render(): void {
    for (const c of modelCards()) {
      const chips = this.chipsOf(c.modelId);
      const existing = c.el.querySelector<HTMLElement>(`:scope > [${CHIPS_ATTR}]`);
      if (chips.length === 0) {
        existing?.remove();
        continue;
      }
      const box = existing ?? this.makeBox(c.el, c.modelId);
      const sig = JSON.stringify(chips);
      if (box.dataset.sig === sig) continue;
      box.dataset.sig = sig;
      box.replaceChildren(...chips.map(chipEl));
    }
  }

  private makeBox(card: HTMLAnchorElement, modelId: number): HTMLElement {
    if (getComputedStyle(card).position === "static") card.style.position = "relative";
    const box = document.createElement("span");
    box.className = "lmf-chips";
    box.setAttribute(CHIPS_ATTR, String(modelId));
    // the chips sit inside civitai's <a>: swallow the whole gesture so the card never navigates
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    box.addEventListener("pointerdown", swallow);
    box.addEventListener("mousedown", swallow);
    box.addEventListener("click", (e) => {
      swallow(e);
      const el =
        e.target instanceof Element ? e.target.closest<HTMLElement>("[data-install]") : null;
      const raw = el?.dataset.install;
      if (raw == null) return;
      void this.install(modelId, raw === "" ? null : Number(raw));
    });
    box.addEventListener("pointerenter", () => this.tip.show(box, this.tipInput(modelId)));
    box.addEventListener("pointerleave", () => this.tip.hide());
    card.appendChild(box);
    return box;
  }

  private tipInput(modelId: number): TipInput {
    const m = this.remote.get(modelId) ?? null;
    const presence = this.known.get(modelId) ?? null;
    return {
      modelId,
      presence,
      groups:
        m == null ? [] : baseGroups(m.versions, presence?.versions.map((v) => v.versionId) ?? []),
      jobs: this.jobs,
      target: (v) => (m == null ? null : this.ctx.target(m, v)),
    };
  }

  private setJob(modelId: number, versionId: number, s: DownloadState): void {
    if (s.kind === "done") {
      this.jobs.delete(versionId);
      this.known.delete(modelId);
      this.tip.forget(modelId);
    } else {
      this.jobs.set(versionId, s);
    }
    this.schedule();
  }

  /** versionId null: civitai's default (first listed) version */
  async install(modelId: number, versionId: number | null): Promise<void> {
    const running = versionId != null ? this.jobs.get(versionId) : undefined;
    if (running != null && running.kind !== "failed") return;
    let vid = versionId;
    try {
      const m = this.remote.get(modelId) ?? (await fetchCivitaiModel(location.origin, modelId));
      this.remote.set(modelId, m);
      const v = vid != null ? m.versions.find((x) => x.id === vid) : m.versions[0];
      if (v == null) throw new Error("this model has no such version");
      vid = v.id;
      this.setJob(modelId, v.id, { kind: "starting" });
      const prefix = lmPrefixForCivitaiType(m.type);
      if (prefix == null) throw new Error(`Civitai type ${m.type} is not handled`);
      await this.ctx.ensure(prefix);
      const t = this.ctx.target(m, v);
      if (t == null || t.root === "") throw new Error(`LoRA Manager has no ${prefix} root`);
      const r = await send({
        kind: "startDownload",
        target: {
          modelId,
          versionId: v.id,
          prefix,
          folder: { root: t.root, sub: t.sub },
          fileId: weightFiles(v)[0]?.id ?? null,
        },
      });
      const started = v.id;
      watchDownload({
        modelId,
        versionId: started,
        downloadId: r.downloadId,
        isAlive: () => true,
        onState: (s) => this.setJob(modelId, started, s),
      });
    } catch (e) {
      if (vid != null) this.setJob(modelId, vid, { kind: "failed", message: errorMessage(e) });
      else console.warn("[lm-free] install:", errorMessage(e));
    }
  }
}

/** rules, roots and last folders held in memory, so every chip resolves its target synchronously */
class FolderCtx {
  private rules: TagRule[] = [];
  private roots = new Map<LmPrefix, string[]>();
  private last = new Map<LmPrefix, FolderPick | null>();
  private loading = new Set<LmPrefix>();

  constructor(
    private draft: () => TagRule | null,
    private changed: () => void,
  ) {
    void getTagRules().then((r) => {
      this.rules = r;
      changed();
    });
    onTagRulesChanged((r) => {
      this.rules = r;
      changed();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (Object.keys(changes).some((k) => k.startsWith("lastFolder:"))) {
        this.last.clear();
        changed();
      }
    });
  }

  forgetRoots(): void {
    this.roots.clear();
  }

  async ensure(prefix: LmPrefix): Promise<void> {
    if (this.roots.has(prefix) && this.last.has(prefix)) return;
    const [choices, last] = await Promise.all([
      send({ kind: "folderChoices", prefix }),
      getLastFolder(prefix),
    ]);
    this.roots.set(prefix, choices.roots);
    this.last.set(prefix, last);
  }

  /** null until the roots of that type are loaded (a load starts and re-renders when done) */
  target(m: CivitaiModel, v: CivitaiVersion): Target | null {
    const prefix = lmPrefixForCivitaiType(m.type);
    if (prefix == null) return null;
    const roots = this.roots.get(prefix);
    if (roots == null || !this.last.has(prefix)) {
      if (!this.loading.has(prefix)) {
        this.loading.add(prefix);
        void this.ensure(prefix)
          .catch((e: unknown) => console.warn("[lm-free] roots:", errorMessage(e)))
          .finally(() => {
            this.loading.delete(prefix);
            this.changed();
          });
      }
      return null;
    }
    const r = resolveFolder({
      roots,
      modelTags: m.tags,
      pageTag: parsePageTag(location.href),
      rules: withDraft(this.rules, this.draft()),
      last: this.last.get(prefix) ?? null,
      baseModel: v.baseModel,
    });
    return {
      root: r.pick.root,
      rootLabel: rootLabels(roots).get(r.pick.root) ?? r.pick.root,
      sub: r.pick.sub,
    };
  }
}

export type ChipInput = {
  /** undefined: LM has not answered yet */
  presence: Presence | null | undefined;
  remote: CivitaiModel | null;
  jobs: ReadonlyMap<number, DownloadState>;
  target: (v: CivitaiVersion) => Target | null;
};

const baseName = (g: BaseGroup) => g.base ?? "other";

/** agent/spec.md "listing cards": one chip per base model, or a stand in until civitai's data is in */
export function chipsFor(p: ChipInput): Chip[] {
  if (p.presence === undefined) return [];
  const localIds = p.presence?.versions.map((v) => v.versionId) ?? [];
  if (p.remote == null) {
    if (p.presence == null) return [{ cls: "lmf-hot", text: "⬇ Install", install: null }];
    const n = p.presence.versions.length;
    return [{ cls: "lmf-cool", text: n > 1 ? `✓ LM ×${n}` : "✓ LM" }];
  }
  const groups = baseGroups(p.remote.versions, localIds);
  const chips = groups.slice(0, MAX_BASE_CHIPS).map((g): Chip => {
    const name = baseName(g);
    const job = p.jobs.get(g.latest.id);
    if (job != null && job.kind !== "idle" && job.kind !== "done") {
      if (job.kind === "failed")
        return { cls: "lmf-danger", text: `✕ ${name} failed`, install: g.latest.id };
      const progress = job.kind === "starting" ? "…" : (job.stage ?? `${Math.round(job.percent)}%`);
      return { cls: "lmf-hot lmf-busy", text: `⬇ ${name} ${progress}` };
    }
    if (hasNewer(g)) return { cls: "lmf-hot", text: `⬆ NEWER ${name}`, install: g.latest.id };
    if (g.have != null) return { cls: "lmf-cool", text: `✓ ${name}` };
    const t = p.target(g.latest);
    return t != null
      ? { cls: "lmf-hot", text: `⬇ ${name}`, install: g.latest.id, target: t }
      : { cls: "lmf-hot", text: `⬇ ${name}`, install: g.latest.id };
  });
  if (groups.length > MAX_BASE_CHIPS)
    chips.push({ cls: "lmf-more", text: `+${groups.length - MAX_BASE_CHIPS}` });
  return chips;
}

function chipEl(c: Chip): HTMLElement {
  const el = document.createElement("span");
  el.className = `lmf-chip ${c.cls}`;
  if (c.install !== undefined) {
    el.dataset.install = c.install == null ? "" : String(c.install);
    el.setAttribute("role", "button");
  }
  el.append(c.text);
  if (c.target != null) {
    const root = document.createElement("span");
    root.className = "lmf-root";
    root.textContent = c.target.rootLabel;
    const sub = document.createElement("span");
    sub.className = "lmf-sub";
    sub.textContent = c.target.sub !== "" ? c.target.sub : "(root)";
    el.append(root, sub);
  }
  return el;
}

export type TipInput = {
  modelId: number;
  presence: Presence | null;
  groups: BaseGroup[];
  jobs: ReadonlyMap<number, DownloadState>;
  target: (v: CivitaiVersion) => Target | null;
};

const PREFIX_BY_LM_TYPE: Record<string, LmPrefix> = {
  lora: "loras",
  checkpoint: "checkpoints",
  embedding: "embeddings",
};

/** one shared tooltip element for every model card. paths are fetched on first hover, then cached */
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
    if (this.anchor?.getAttribute(CHIPS_ATTR) === String(p.modelId)) this.render(p);
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
  const out: TipLine[] = [];
  if (p.presence == null) out.push({ text: "Not in your library", cls: "head" });
  else {
    out.push({ text: `In your library (${p.presence.modelType})`, cls: "head" });
    for (const v of p.presence.versions) {
      const g = p.groups.find((x) => x.have?.id === v.versionId || x.latest.id === v.versionId);
      out.push({ text: `${v.name}${g?.base != null ? ` · ${g.base}` : ""}` });
      const where = paths?.get(v.versionId);
      if (where == null)
        out.push({ text: paths == null ? "  locating…" : `  ${v.fileName}`, cls: "muted" });
      else for (const w of where) out.push({ text: `  ${w}`, cls: "muted" });
    }
  }
  for (const g of p.groups) {
    const name = baseName(g);
    const job = p.jobs.get(g.latest.id);
    if (job?.kind === "failed")
      out.push({ text: `✕ ${name}: ${job.message} (click to retry)`, cls: "bad" });
    else if (hasNewer(g))
      out.push({
        text: `⬆ ${name}: newer ${g.latest.name} on Civitai (click to install)`,
        cls: "hot",
      });
    else if (g.have != null)
      out.push({ text: `✓ ${name}: up to date (${g.have.name})`, cls: "cool" });
    else {
      const t = p.target(g.latest);
      const where = t != null ? ` → ${t.rootLabel} › ${t.sub !== "" ? t.sub : "(root)"}` : "";
      out.push({ text: `⬇ ${name}: ${g.latest.name} not installed${where}`, cls: "muted" });
    }
  }
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

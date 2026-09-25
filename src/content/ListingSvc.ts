import { action, makeObservable, observable } from "mobx";

import {
  baseGroups,
  fetchCivitaiModel,
  fetchCivitaiModels,
  hasNewer,
  lmPrefixForCivitaiType,
  modelIdFromHref,
  weightFiles,
  type BaseGroup,
  type CivitaiModel,
  type CivitaiVersion,
  type LmPrefix,
} from "src/shared/civitai.ts";
import { resolveFolder, withDraft } from "src/shared/folderRules.ts";
import type { PageStats } from "src/content/RulesSvc.ts";
import type { LibraryBatch } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { rootLabels, whereInLibrary } from "src/shared/paths.ts";
import { matchRule, type ModelFacts, type Rule, type RuleCond } from "src/shared/rules.ts";
import {
  getLastFolder,
  getMarked,
  getRules,
  onMarkedChanged,
  onRulesChanged,
  setMarked,
  type FolderPick,
  type MarkedItem,
} from "src/shared/storage.ts";
import { reportError } from "src/content/ErrorSvc.ts";
import { PAGE_CSS } from "src/shared/theme.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

type Presence = LibraryBatch[string];

const CHIPS_ATTR = "data-lmf-chips";
const PAGE_CSS_ID = "lmf-page-css";
const DEBOUNCE_MS = 300;
/** keeps the query strings of check-models-exist and civitai's models?ids= under their limits */
const CHUNK = 100;
/** civitai mutates its dom constantly: without this, an unreachable LM gets a call every pass */
const DOWN_BACKOFF_MS = 30_000;
/** civitai rate limits bursts: a failed details call waits this long before the next try */
const CIVITAI_BACKOFF_MS = 10_000;
const MAX_BASE_CHIPS = 4;

export type Target = { root: string; rootLabel: string; sub: string; manual?: boolean };

export type ChipAct = { kind: "install" | "mark" | "unmark"; versionId: number | null };

export type Chip = {
  cls:
    | "lmf-cool"
    | "lmf-hot"
    | "lmf-danger"
    | "lmf-hot lmf-busy"
    | "lmf-more"
    | "lmf-more lmf-wait"
    | "lmf-more lmf-off";
  text: string;
  /** a small spinner before the text: data still on its way */
  spin?: true;
  title?: string;
  /** the chip's one button: what it does and what it says; absent = no button */
  act?: ChipAct;
  actLabel?: string;
  /** where it would land; a click on it opens the target editor for that version */
  target?: Target;
  editVersion?: number;
};

/** a click on a chip's target: which version, and where on screen to open the editor */
export type EditRequest = {
  modelId: number;
  versionId: number;
  rect: { left: number; top: number; bottom: number };
  /** which half of the path was clicked: the editor focuses that control */
  part: "root" | "sub";
};

/** what the target editor feeds back: manual targets and file picks per version */
export type ListingDeps = {
  draft: () => Rule | null;
  onStats: (s: PageStats) => void;
  focus: () => RuleCond | null;
  override: (versionId: number) => FolderPick | null;
  fileFor: (versionId: number) => number | null;
  onEdit: (req: EditRequest) => void;
};

/** the chips on every civitai model card, one per base model (agent/spec.md "listing cards"). plain dom */
export class ListingSvc {
  /** null = checked and absent */
  private known = new Map<number, Presence | null>();
  /** civitai's view of each model on screen. null = civitai answered without it; absent = not in yet */
  private remote = new Map<number, CivitaiModel | null>();
  private remoteInflight = new Set<number>();
  private remoteRetryAfter = 0;
  /** install jobs by version id */
  private jobs = new Map<number, DownloadState>();
  private inflight = new Set<number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPassAt = 0;
  private disposed = false;
  private retryAfter = 0;
  private observer: MutationObserver;
  private tip = new Tip();
  private ctx: FolderCtx;
  /** the model page's own model: fetched and watched even though it is not a tile */
  private watched: number | null = null;
  /** the last library call's error, null when it answered: tiles show it, the watched model turns into mark chips */
  private lmError: string | null = null;
  private marked = new Set<number>();
  /** bumped after every pass: the model page row (react) reads it to re-render */
  rev = 0;

  constructor(private deps: ListingDeps) {
    makeObservable<ListingSvc, "bump">(this, { rev: observable, bump: action });
    injectPageCss();
    this.ctx = new FolderCtx(deps, () => this.schedule());
    void getMarked().then((m) => this.setMarked(m));
    onMarkedChanged((m) => this.setMarked(m));
    this.observer = new MutationObserver(() => this.schedule());
    this.observer.observe(document.body, { childList: true, subtree: true });
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    this.observer.disconnect();
    if (this.timer != null) clearTimeout(this.timer);
    this.tip.hide();
    for (const b of document.querySelectorAll(`[${CHIPS_ATTR}]`)) b.remove();
    document.getElementById(PAGE_CSS_ID)?.remove();
  }

  /** a rule, a draft or the last folder changed: retarget every chip */
  refresh(): void {
    this.schedule();
  }

  private bump(): void {
    this.rev++;
  }

  private setMarked(items: MarkedItem[]): void {
    this.marked = new Set(items.map((i) => i.versionId));
    this.schedule();
  }

  /** the model page's model: its chips show in the bar row */
  watch(modelId: number | null): void {
    if (this.watched === modelId) return;
    this.watched = modelId;
    this.schedule();
  }

  modelOf(modelId: number): CivitaiModel | null {
    void this.rev;
    return this.remote.get(modelId) ?? null;
  }

  get isLmDown(): boolean {
    void this.rev;
    return this.lmError != null;
  }

  targetOf(modelId: number, versionId: number): Target | null {
    const m = this.remote.get(modelId);
    const v = m?.versions.find((x) => x.id === versionId);
    return m == null || v == null ? null : this.ctx.target(m, v);
  }

  showTip(anchor: HTMLElement, modelId: number): void {
    this.tip.show(anchor, modelId, () => this.tipInput(modelId));
  }

  hideTip(): void {
    this.tip.hide();
  }

  run(modelId: number, act: ChipAct): Promise<void> {
    if (act.kind === "install") return this.install(modelId, act.versionId);
    if (act.versionId == null) return Promise.resolve();
    return act.kind === "mark" ? this.mark(modelId, act.versionId) : this.unmark(act.versionId);
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
    this.remoteRetryAfter = 0;
    this.schedule();
  }

  private schedule(delay?: number): void {
    if (this.timer != null || this.disposed) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        this.lastPassAt = Date.now();
        void this.pass();
      },
      delay ?? nextPassDelay(this.lastPassAt, Date.now()),
    );
  }

  private async pass(): Promise<void> {
    const onScreen = modelCards();
    if (this.watched != null)
      onScreen.push({ el: document.createElement("a"), modelId: this.watched });
    const missing = unknownIds(onScreen, this.known, this.inflight);
    const noRemote =
      Date.now() >= this.remoteRetryAfter
        ? unknownIds(onScreen, this.remote, this.remoteInflight)
        : [];
    // parallel, each renders as it lands: a slow LM never holds back civitai's data
    const lm =
      missing.length > 0 && Date.now() >= this.retryAfter
        ? Promise.all(chunk(missing, CHUNK).map((ids) => this.fetch(ids)))
        : null;
    const civitai =
      noRemote.length > 0
        ? Promise.all(chunk(noRemote, CHUNK).map((ids) => this.fetchRemote(ids)))
        : null;
    this.render();
    await Promise.all([lm?.then(() => this.render()), civitai?.then(() => this.render())]);
  }

  private async fetch(ids: number[]): Promise<void> {
    for (const id of ids) this.inflight.add(id);
    try {
      const found = await send({ kind: "libraryBatch", modelIds: ids });
      for (const id of ids) this.known.set(id, found[String(id)] ?? null);
      this.lmError = null;
    } catch (e) {
      this.lmError = errorMessage(e);
      this.retryAfter = Date.now() + DOWN_BACKOFF_MS;
      setTimeout(() => this.schedule(0), DOWN_BACKOFF_MS);
      reportError("LoRA Manager library check (retry in 30 s)", e);
    } finally {
      for (const id of ids) this.inflight.delete(id);
    }
  }

  private async fetchRemote(ids: number[]): Promise<void> {
    for (const id of ids) this.remoteInflight.add(id);
    try {
      const models = await fetchCivitaiModels(location.origin, ids);
      for (const id of ids) this.remote.set(id, models.get(id) ?? null);
    } catch (e) {
      this.remoteRetryAfter = Date.now() + CIVITAI_BACKOFF_MS;
      setTimeout(() => this.schedule(0), CIVITAI_BACKOFF_MS);
      reportError("civitai model details (retry in 10 s)", e);
    } finally {
      for (const id of ids) this.remoteInflight.delete(id);
    }
  }

  private chipsOf(modelId: number, modelPage = false): Chip[] {
    const m = this.remote.get(modelId);
    return chipsFor({
      presence: this.known.has(modelId) ? (this.known.get(modelId) ?? null) : undefined,
      remote: m,
      lmError: this.inflight.has(modelId) ? null : this.lmError,
      jobs: this.jobs,
      focus: this.deps.focus(),
      max: modelPage ? Infinity : MAX_BASE_CHIPS,
      mode: modelPage && this.lmError != null ? "mark" : "install",
      isMarked: (vid) => this.marked.has(vid),
      target: (v) => (m == null ? null : this.ctx.target(m, v)),
    });
  }

  /** idempotent: rebuilds a card's chips only when their content changed, so it never feeds the observer a loop */
  private render(): void {
    if (this.disposed) return;
    const cards = modelCards();
    this.tip.refresh();
    this.deps.onStats(
      pageStats(
        cards.map((c) => this.remote.get(c.modelId) ?? null),
        this.deps.draft(),
      ),
    );
    this.bump();
    for (const c of cards) {
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
    this.renderHero();
  }

  /** the model page's chips, on its first showcase image (agent/spec.md "the model page") */
  private renderHero(): void {
    const id = this.watched;
    const host = id == null ? null : showcaseHost();
    for (const b of document.querySelectorAll<HTMLElement>("[data-lmf-hero]"))
      if (b.parentElement !== host) b.remove();
    if (id == null || host == null) return;
    const chips = this.chipsOf(id, true);
    const existing = host.querySelector<HTMLElement>(":scope > [data-lmf-hero]");
    if (chips.length === 0) {
      existing?.remove();
      return;
    }
    const box = existing ?? this.makeBox(host, id, true);
    const sig = JSON.stringify(chips);
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.replaceChildren(...chips.map(chipEl));
  }

  private makeBox(card: HTMLElement, modelId: number, hero = false): HTMLElement {
    if (getComputedStyle(card).position === "static") card.style.position = "relative";
    const box = document.createElement("span");
    box.className = hero ? "lmf-chips lmf-hero" : "lmf-chips";
    box.setAttribute(CHIPS_ATTR, String(modelId));
    if (hero) box.setAttribute("data-lmf-hero", "");
    // the chips sit inside civitai's <a>: swallow the whole gesture so the card never navigates
    const swallow = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    box.addEventListener("pointerdown", swallow);
    box.addEventListener("mousedown", swallow);
    box.addEventListener("click", (e) => {
      swallow(e);
      const t = e.target instanceof Element ? e.target : null;
      const edit = t?.closest<HTMLElement>("[data-edit]");
      if (edit?.dataset.edit != null) {
        const clicked = t?.closest<HTMLElement>("[data-part]") ?? edit;
        const r = clicked.getBoundingClientRect();
        this.deps.onEdit({
          modelId,
          versionId: Number(edit.dataset.edit),
          rect: { left: r.left, top: r.top, bottom: r.bottom },
          part: clicked.dataset.part === "root" ? "root" : "sub",
        });
        return;
      }
      const chip = t?.closest<HTMLElement>("[data-act]");
      if (chip?.dataset.act == null) return;
      void this.run(modelId, parseAct(chip.dataset.act));
    });
    box.addEventListener("pointerenter", () =>
      this.tip.show(box, modelId, () => this.tipInput(modelId)),
    );
    box.addEventListener("pointerleave", () => this.tip.hide());
    card.appendChild(box);
    return box;
  }

  private tipInput(modelId: number): TipInput {
    const m = this.remote.get(modelId) ?? null;
    const presence = this.known.get(modelId) ?? null;
    const pending = this.known.has(modelId)
      ? null
      : this.lmError != null && !this.inflight.has(modelId)
        ? `LoRA Manager unreachable: ${this.lmError}`
        : "Waiting for LoRA Manager…";
    return {
      modelId,
      presence,
      ...(pending != null ? { pending } : {}),
      groups:
        m == null ? [] : baseGroups(m.versions, presence?.versions.map((v) => v.versionId) ?? []),
      jobs: this.jobs,
      target: (v) => (m == null ? null : this.ctx.target(m, v)),
    };
  }

  private setJob(modelId: number, versionId: number, s: DownloadState): void {
    if (s.kind === "failed") reportError(`install version ${versionId}`, s.message);
    if (s.kind === "done") {
      this.jobs.delete(versionId);
      this.known.delete(modelId);
      this.tip.forget(modelId);
    } else {
      this.jobs.set(versionId, s);
    }
    this.schedule();
  }

  /** a version with its target and file, onto the popup's marked list */
  private async mark(modelId: number, versionId: number): Promise<void> {
    const m = this.remote.get(modelId);
    const v = m?.versions.find((x) => x.id === versionId);
    const prefix = m != null ? lmPrefixForCivitaiType(m.type) : null;
    const t = m != null && v != null ? this.ctx.target(m, v) : null;
    if (m == null || v == null || prefix == null || t == null) return;
    const fileId = this.deps.fileFor(v.id) ?? weightFiles(v)[0]?.id ?? null;
    const file = v.files.find((f) => f.id === fileId);
    const items = (await getMarked()).filter((i) => i.versionId !== v.id);
    await setMarked([
      ...items,
      {
        modelId,
        versionId: v.id,
        modelName: m.name,
        versionName: `${v.name}${v.baseModel != null ? ` · ${v.baseModel}` : ""}`,
        prefix,
        folder: { root: t.root, sub: t.sub },
        file: file != null && v.files.length > 1 ? { id: file.id, label: file.name } : null,
      },
    ]);
  }

  private async unmark(versionId: number): Promise<void> {
    await setMarked((await getMarked()).filter((i) => i.versionId !== versionId));
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
          fileId: this.deps.fileFor(v.id) ?? weightFiles(v)[0]?.id ?? null,
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
      else reportError("install", e);
    }
  }
}

/** rules, roots and last folders held in memory, so every chip resolves its target synchronously */
class FolderCtx {
  private rules: Rule[] = [];
  private roots = new Map<LmPrefix, string[]>();
  private last = new Map<LmPrefix, FolderPick | null>();
  private loading = new Set<LmPrefix>();

  constructor(
    private deps: Pick<ListingDeps, "draft" | "override">,
    private changed: () => void,
  ) {
    void getRules().then((r) => {
      this.rules = r;
      changed();
    });
    onRulesChanged((r) => {
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
          .catch((e: unknown) => reportError(`LoRA Manager ${prefix} roots`, e))
          .finally(() => {
            this.loading.delete(prefix);
            this.changed();
          });
      }
      return null;
    }
    const labels = rootLabels(roots);
    const manual = this.deps.override(v.id);
    if (manual != null)
      return {
        root: manual.root,
        rootLabel: labels.get(manual.root) ?? manual.root,
        sub: manual.sub,
        manual: true,
      };
    const r = resolveFolder({
      roots,
      model: factsOf(m),
      baseModel: v.baseModel,
      rules: withDraft(this.rules, this.deps.draft()),
      last: this.last.get(prefix) ?? null,
    });
    return {
      root: r.pick.root,
      rootLabel: labels.get(r.pick.root) ?? r.pick.root,
      sub: r.pick.sub,
    };
  }
}

export type ChipInput = {
  /** undefined: LM has not answered yet */
  presence: Presence | null | undefined;
  /** undefined: civitai has not answered yet; null: it answered without this model */
  remote: CivitaiModel | null | undefined;
  /** LM unreachable, and this card has no answer from it */
  lmError?: string | null;
  jobs: ReadonlyMap<number, DownloadState>;
  /** focus in force: install chips only for matching versions */
  focus?: RuleCond | null;
  /** how many base chips before +N */
  max?: number;
  /** mark: LM is down, chips queue versions for the popup's Download all */
  mode?: "install" | "mark";
  isMarked?: (versionId: number) => boolean;
  target: (v: CivitaiVersion) => Target | null;
};

const baseName = (g: BaseGroup) => g.base ?? "other";

/** agent/spec.md "listing cards": one chip per base model, or a stand in until civitai's data is in */
const WAIT: Chip = { cls: "lmf-more lmf-wait", text: "", spin: true };

export function chipsFor(p: ChipInput): Chip[] {
  const max = p.max ?? MAX_BASE_CHIPS;
  const focus = p.focus ?? null;
  if (p.mode === "mark") {
    if (p.remote === undefined) return [WAIT];
    if (p.remote == null) return [];
    const facts = factsOf(p.remote);
    const all = baseGroups(p.remote.versions, []);
    const shown = all.filter(
      (g) =>
        focus == null ||
        p.isMarked?.(g.latest.id) === true ||
        matchRule(focus, facts, g.latest.baseModel),
    );
    const chips = shown.slice(0, max).map((g): Chip => {
      const id = g.latest.id;
      const t = p.target(g.latest);
      const marked = p.isMarked?.(id) === true;
      return {
        cls: marked ? "lmf-cool" : "lmf-hot",
        text: marked ? "★ marked" : "",
        act: { kind: marked ? "unmark" : "mark", versionId: id },
        actLabel: `${marked ? "Unmark" : "Mark"} ${baseName(g)}`,
        ...(t != null ? { target: t, editVersion: id } : {}),
      };
    });
    return withTail(chips, shown.length, all.length, max);
  }
  if (p.presence === undefined)
    return p.lmError != null
      ? [{ cls: "lmf-more lmf-off", text: "LM offline", title: p.lmError }]
      : [WAIT];
  const localIds = p.presence?.versions.map((v) => v.versionId) ?? [];
  if (p.remote === undefined && focus != null) return [WAIT];
  if (p.remote == null) {
    // under focus an unknown model gets no install chip: its base model is not known yet
    if (p.presence == null)
      return focus != null
        ? []
        : [
            {
              cls: "lmf-hot",
              text: "",
              act: { kind: "install", versionId: null },
              actLabel: "Get",
            },
          ];
    const n = p.presence.versions.length;
    return [{ cls: "lmf-cool", text: n > 1 ? `✓ LM ×${n}` : "✓ LM" }];
  }
  const facts = factsOf(p.remote);
  const all = baseGroups(p.remote.versions, localIds);
  // focus hides install chips only: what you have, and newer versions of it, always show
  const groups = all.filter(
    (g) =>
      focus == null ||
      g.have != null ||
      p.jobs.has(g.latest.id) ||
      matchRule(focus, facts, g.latest.baseModel),
  );
  const chips = groups.slice(0, max).map((g): Chip => {
    const name = baseName(g);
    const id = g.latest.id;
    const install: ChipAct = { kind: "install", versionId: id };
    const job = p.jobs.get(id);
    if (job != null && job.kind !== "idle" && job.kind !== "done") {
      if (job.kind === "failed")
        return { cls: "lmf-danger", text: "failed", act: install, actLabel: `Retry ${name}` };
      const progress = job.kind === "starting" ? "…" : (job.stage ?? `${Math.round(job.percent)}%`);
      return { cls: "lmf-hot lmf-busy", text: `${name} ${progress}` };
    }
    if (g.have != null && !hasNewer(g)) return { cls: "lmf-cool", text: `✓ ${name}` };
    const t = p.target(g.latest);
    const newer = hasNewer(g);
    const chip: Chip = {
      cls: "lmf-hot",
      text: newer ? `→ ${g.latest.name}` : "",
      act: install,
      actLabel: `${newer ? "Update" : "Get"} ${name}`,
    };
    return t != null ? { ...chip, target: t, editVersion: id } : chip;
  });
  return withTail(chips, groups.length, all.length, max);
}

/** the grey tail chips: overflow past max, then what focus hid (agent/spec.md "focus") */
function withTail(chips: Chip[], shown: number, total: number, max: number): Chip[] {
  const out = [...chips];
  if (shown > max) out.push({ cls: "lmf-more", text: `+${shown - max}` });
  if (total > shown) out.push({ cls: "lmf-more", text: `+${total - shown} unfocused` });
  return out;
}

export function actKey(a: ChipAct): string {
  return `${a.kind}:${a.versionId ?? ""}`;
}

export function parseAct(raw: string): ChipAct {
  const [kind, id] = raw.split(":");
  const k = kind === "mark" || kind === "unmark" ? kind : "install";
  return { kind: k, versionId: id != null && id !== "" ? Number(id) : null };
}

function chipEl(c: Chip): HTMLElement {
  const el = document.createElement("span");
  el.className = `lmf-chip ${c.cls}`;
  if (c.title != null) el.title = c.title;
  if (c.spin === true) {
    const s = document.createElement("span");
    s.className = "lmf-spin";
    el.append(s);
  }
  if (c.act != null) {
    const b = document.createElement("span");
    b.className = "lmf-get";
    b.setAttribute("role", "button");
    b.dataset.act = actKey(c.act);
    b.textContent = c.actLabel ?? "Get";
    el.append(b);
  }
  if (c.text !== "") {
    const label = document.createElement("span");
    label.className = "lmf-label";
    label.textContent = c.text;
    el.append(label);
  }
  if (c.target != null) {
    const target = document.createElement("span");
    target.className = "lmf-target";
    if (c.editVersion != null) target.dataset.edit = String(c.editVersion);
    const part = (name: "root" | "sub", text: string, title: string) => {
      const x = document.createElement("span");
      x.className = name === "root" ? "lmf-root" : "lmf-sub";
      x.dataset.part = name;
      x.title = title;
      x.textContent = text;
      return x;
    };
    const slash = document.createElement("span");
    slash.className = "lmf-slash";
    slash.textContent = "/";
    target.append(
      part("root", c.target.rootLabel, "Change the model root"),
      slash,
      part("sub", subText(c.target), "Change the subfolder"),
    );
    el.append(target);
  }
  return el;
}

export function subText(t: Target): string {
  return `${t.manual === true ? "✎ " : ""}${t.sub !== "" ? t.sub : "(root)"}`;
}

export type TipInput = {
  modelId: number;
  presence: Presence | null;
  /** LM has not given this card an answer: the one line the tip shows */
  pending?: string;
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

  /** a live getter, not a snapshot: the tip follows downloads and path loads while it is open */
  private current: { modelId: number; get: () => TipInput } | null = null;

  show(anchor: HTMLElement, modelId: number, get: () => TipInput): void {
    this.anchor = anchor;
    this.current = { modelId, get };
    this.refresh();
  }

  /** re-render from fresh data; after every listing pass and when paths arrive */
  refresh(): void {
    const cur = this.current;
    if (this.anchor == null || cur == null) return;
    if (!this.anchor.isConnected) return this.hide();
    const p = cur.get();
    if (p.presence != null && !this.paths.has(p.modelId)) void this.loadPaths(p);
    this.render(p);
  }

  hide(): void {
    this.anchor = null;
    this.current = null;
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
      reportError("tooltip file paths", e);
    }
    if (this.current?.modelId === p.modelId) this.refresh();
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
  if (p.pending != null) return [{ text: p.pending, cls: "muted" }];
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

export function factsOf(m: CivitaiModel): ModelFacts {
  return { name: m.name, tags: m.tags, prefix: lmPrefixForCivitaiType(m.type) };
}

/** cards on screen, how many the draft matches (any version), and their tags and bases by frequency */
export function pageStats(models: (CivitaiModel | null)[], draft: Rule | null): PageStats {
  const tags = new Map<string, number>();
  const bases = new Map<string, number>();
  let matched = 0;
  for (const m of models) {
    if (m == null) continue;
    for (const t of m.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    const seen = new Set(m.versions.map((v) => v.baseModel).filter((b): b is string => b != null));
    for (const b of seen) bases.set(b, (bases.get(b) ?? 0) + 1);
    if (draft != null && m.versions.some((v) => matchRule(draft.cond, factsOf(m), v.baseModel)))
      matched++;
  }
  const top = (xs: Map<string, number>, n: number) =>
    [...xs].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { total: models.length, matched, tags: top(tags, 12), bases: top(bases, 8) };
}

/** the parent of the first showcase image or video of a model page: large, from civitai's image cdn,
 *  not a suggestion tile (a link to a model) and not in the header */
function showcaseHost(): HTMLElement | null {
  for (const media of document.querySelectorAll<HTMLElement>(
    'img[src*="image.civitai.com"], video',
  )) {
    if (media.closest('header, a[href*="/models/"], [data-lmf-chips]') != null) continue;
    const r = media.getBoundingClientRect();
    if (r.width < 200 || r.height < 150) continue;
    return media.parentElement;
  }
  return null;
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
  if (document.getElementById(PAGE_CSS_ID) != null) return;
  const style = document.createElement("style");
  style.id = PAGE_CSS_ID;
  style.textContent = PAGE_CSS;
  document.head.appendChild(style);
}

/** leading edge: a quiet page gets its pass at once, a burst of mutations waits out the debounce */
export function nextPassDelay(lastPassAt: number, now: number): number {
  return Math.max(0, lastPassAt + DEBOUNCE_MS - now);
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

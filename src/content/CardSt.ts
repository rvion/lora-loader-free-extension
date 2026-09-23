import { makeAutoObservable, runInAction } from "mobx";

import {
  fetchCivitaiModel,
  lmPrefixForCivitaiType,
  parseCivitaiModelUrl,
  type CivitaiModel,
  type CivitaiPageRef,
  type LmPrefix,
} from "src/shared/civitai.ts";
import type { FolderChoices, LibraryStatus } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import { RestartSt } from "src/shared/RestartSt.ts";
import {
  getLastFolder,
  getMarked,
  getSettings,
  onMarkedChanged,
  onSettingsChanged,
  saveLmUrl,
  setLastFolder,
  setMarked,
  type FolderPick,
  type MarkedItem,
} from "src/shared/storage.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

/** root of the card: one per page, lives as long as the tab */
export class CardSt {
  page: PageSvc;
  library: LibrarySvc;
  folder: FolderSvc;
  download: DownloadSvc;
  marks: MarkSvc;
  server: ServerSvc;
  restart: RestartSt;
  collapsed = false;

  constructor() {
    this.page = new PageSvc();
    this.server = new ServerSvc(this);
    this.restart = new RestartSt({
      restart: () => send({ kind: "restartComfy" }),
      ping: () => send({ kind: "ping" }),
      onBack: () => void this.refreshForVersion(),
    });
    this.library = new LibrarySvc(this);
    this.folder = new FolderSvc(this);
    this.download = new DownloadSvc(this);
    this.marks = new MarkSvc(this);
    makeAutoObservable(this, {
      page: false,
      library: false,
      folder: false,
      download: false,
      marks: false,
      server: false,
      restart: false,
    });
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  /** called on every url change the page makes */
  onUrl(href: string): void {
    const ref = parseCivitaiModelUrl(href);
    if (!this.page.setRef(ref)) return;
    this.download.reset();
    if (ref == null) return;
    void this.page.load().then(() => this.refreshForVersion());
  }

  async refreshForVersion(): Promise<void> {
    const m = this.page.model.result;
    const v = this.page.version;
    const prefix = this.page.prefix;
    if (m == null || v == null || prefix == null) return;
    await Promise.all([
      this.library.check(),
      this.folder.load(prefix),
      this.download.resume(m.id, v.id),
    ]);
  }
}

/** the LoRA Manager address, editable from the card, shared with the popup through storage */
export class ServerSvc {
  url = "";
  draft = "";
  isEditing = false;
  saveError: string | null = null;

  constructor(private st: CardSt) {
    makeAutoObservable<ServerSvc, "st">(this, { st: false });
    void getSettings().then((s) => this.applySaved(s.lmUrl, false));
    onSettingsChanged((s) => this.applySaved(s.lmUrl, true));
  }

  applySaved(url: string, recheck: boolean): void {
    const changed = url !== this.url;
    this.url = url;
    this.draft = url;
    if (changed && recheck) {
      this.isEditing = false;
      void this.st.refreshForVersion();
    }
  }

  toggleEditing(): void {
    this.isEditing = !this.isEditing;
    this.draft = this.url;
    this.saveError = null;
  }

  setDraft(v: string): void {
    this.draft = v;
  }

  /** open while editing, and on its own whenever LM cannot be reached */
  get isOpen(): boolean {
    return (
      this.isEditing || this.st.library.status.error != null || this.st.folder.choices.error != null
    );
  }

  async save(): Promise<void> {
    this.saveError = null;
    try {
      const saved = await saveLmUrl(this.draft);
      runInAction(() => (this.draft = saved));
      if (saved === this.url) void this.st.refreshForVersion();
    } catch (e) {
      runInAction(() => (this.saveError = errorMessage(e)));
    }
  }
}

export class PageSvc {
  ref: CivitaiPageRef | null = null;
  model: Query<CivitaiModel>;
  private loadedModelId: number | null = null;

  constructor() {
    this.model = new Query(() => {
      const id = this.ref?.modelId;
      if (id == null) return Promise.reject(new Error("not on a model page"));
      return fetchCivitaiModel(location.origin, id);
    });
    makeAutoObservable<PageSvc, "loadedModelId">(this, {
      model: false,
      loadedModelId: false,
    });
  }

  /** false when the ref did not change */
  setRef(ref: CivitaiPageRef | null): boolean {
    if (ref?.modelId === this.ref?.modelId && ref?.versionId === this.ref?.versionId) return false;
    this.ref = ref;
    return true;
  }

  async load(): Promise<void> {
    const id = this.ref?.modelId ?? null;
    if (id == null || id === this.loadedModelId) return;
    this.loadedModelId = id;
    await this.model.run();
    if (this.model.error != null) runInAction(() => (this.loadedModelId = null));
  }

  get version(): { id: number; name: string } | null {
    const m = this.model.result;
    if (m == null || m.id !== this.ref?.modelId) return null;
    const wanted = this.ref.versionId;
    if (wanted == null) return m.versions[0] ?? null;
    return m.versions.find((v) => v.id === wanted) ?? { id: wanted, name: `version ${wanted}` };
  }

  get prefix(): LmPrefix | null {
    const m = this.model.result;
    return m == null ? null : lmPrefixForCivitaiType(m.type);
  }

  get isModelPage(): boolean {
    return this.ref != null;
  }
}

export class LibrarySvc {
  status: Query<LibraryStatus>;

  constructor(private st: CardSt) {
    this.status = new Query(() => {
      const m = this.st.page.model.result;
      const v = this.st.page.version;
      if (m == null || v == null) return Promise.reject(new Error("no version on this page"));
      return send({ kind: "libraryStatus", modelId: m.id, versionId: v.id });
    });
    makeAutoObservable<LibrarySvc, "st">(this, { st: false, status: false });
  }

  check(): Promise<void> {
    return this.status.run();
  }

  get inLibrary(): boolean {
    return this.status.result?.exists === true;
  }
}

export class FolderSvc {
  choices: Query<FolderChoices>;
  pick: FolderPick = { root: "", sub: "" };
  private prefix: LmPrefix | null = null;

  constructor(private st: CardSt) {
    this.choices = new Query(() => {
      const prefix = this.prefix;
      if (prefix == null) return Promise.reject(new Error("unsupported model type"));
      return send({ kind: "folderChoices", prefix });
    });
    makeAutoObservable<FolderSvc, "st" | "prefix">(this, {
      st: false,
      choices: false,
      prefix: false,
    });
  }

  async load(prefix: LmPrefix): Promise<void> {
    this.prefix = prefix;
    const [last] = await Promise.all([getLastFolder(prefix), this.choices.run()]);
    runInAction(() => {
      const roots = this.choices.result?.roots ?? [];
      const root = last != null && roots.includes(last.root) ? last.root : (roots[0] ?? "");
      this.pick = { root, sub: last?.sub ?? "" };
    });
  }

  setRoot(root: string): void {
    this.pick = { ...this.pick, root };
    this.remember();
  }

  setSub(sub: string): void {
    this.pick = { ...this.pick, sub: normalizeSub(sub) };
    this.remember();
  }

  private remember(): void {
    const prefix = this.st.page.prefix;
    if (prefix != null) void setLastFolder(prefix, this.pick);
  }
}

export function normalizeSub(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

export class DownloadSvc {
  state: DownloadState = { kind: "idle" };
  private generation = 0;

  constructor(private st: CardSt) {
    makeAutoObservable<DownloadSvc, "st" | "generation">(this, { st: false, generation: false });
  }

  reset(): void {
    this.generation++;
    this.state = { kind: "idle" };
  }

  setState(gen: number, s: DownloadState): void {
    if (gen !== this.generation) return;
    this.state = s;
    if (s.kind === "done") void this.st.library.check();
  }

  async start(): Promise<void> {
    const m = this.st.page.model.result;
    const v = this.st.page.version;
    const prefix = this.st.page.prefix;
    if (m == null || v == null || prefix == null) return;
    const gen = ++this.generation;
    this.state = { kind: "starting" };
    try {
      const r = await send({
        kind: "startDownload",
        target: { modelId: m.id, versionId: v.id, prefix, folder: this.st.folder.pick },
      });
      await this.st.marks.remove(v.id);
      this.watch(gen, m.id, v.id, r.downloadId);
    } catch (e) {
      this.setState(gen, { kind: "failed", message: errorMessage(e) });
    }
  }

  async resume(modelId: number, versionId: number): Promise<void> {
    const gen = this.generation;
    const downloadId = await send({ kind: "activeDownload", versionId });
    if (downloadId == null) return;
    this.setState(gen, { kind: "running", percent: 0, stage: null });
    this.watch(gen, modelId, versionId, downloadId);
  }

  private watch(gen: number, modelId: number, versionId: number, downloadId: string): void {
    watchDownload({
      modelId,
      versionId,
      downloadId,
      isAlive: () => gen === this.generation,
      onState: (s) => this.setState(gen, s),
    });
  }

  get isBusy(): boolean {
    return this.state.kind === "starting" || this.state.kind === "running";
  }
}

export class MarkSvc {
  items: MarkedItem[] = [];

  constructor(private st: CardSt) {
    makeAutoObservable<MarkSvc, "st">(this, { st: false });
    void getMarked().then((items) => this.setItems(items));
    onMarkedChanged((items) => this.setItems(items));
  }

  setItems(items: MarkedItem[]): void {
    this.items = items;
  }

  get isMarked(): boolean {
    const v = this.st.page.version;
    return v != null && this.items.some((i) => i.versionId === v.id);
  }

  async toggle(): Promise<void> {
    const m = this.st.page.model.result;
    const v = this.st.page.version;
    const prefix = this.st.page.prefix;
    if (m == null || v == null || prefix == null) return;
    const current = await getMarked();
    const without = current.filter((i) => i.versionId !== v.id);
    const next =
      without.length !== current.length
        ? without
        : [
            ...current,
            {
              modelId: m.id,
              versionId: v.id,
              modelName: m.name,
              versionName: v.name,
              prefix,
              folder: this.st.folder.pick,
            },
          ];
    await setMarked(next);
  }

  async remove(versionId: number): Promise<void> {
    const current = await getMarked();
    const next = current.filter((i) => i.versionId !== versionId);
    if (next.length !== current.length) await setMarked(next);
  }
}

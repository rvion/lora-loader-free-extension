import { makeAutoObservable, runInAction } from "mobx";

import {
  fetchCivitaiModel,
  fileLabel,
  lmPrefixForCivitaiType,
  parseCivitaiModelUrl,
  weightFiles,
  type CivitaiFile,
  type CivitaiModel,
  type CivitaiPageRef,
  type CivitaiVersion,
  type LmPrefix,
} from "src/shared/civitai.ts";
import { suggestFolder, type FolderSuggestion } from "src/shared/folderRules.ts";
import type { LibraryStatus } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { AdSvc } from "src/content/AdSvc.ts";
import { ListingSvc } from "src/content/ListingSvc.ts";
import { PlacementSvc } from "src/content/PlacementSvc.ts";
import { TagSvc } from "src/content/TagSvc.ts";
import { Query } from "src/shared/Query.ts";
import { RestartSt } from "src/shared/RestartSt.ts";
import {
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
  file: FileSvc;
  listing: ListingSvc;
  ads: AdSvc;
  placement: PlacementSvc;
  tag: TagSvc;
  collapsed = false;

  constructor() {
    this.page = new PageSvc();
    this.server = new ServerSvc(this);
    this.file = new FileSvc(this);
    this.listing = new ListingSvc();
    this.ads = new AdSvc();
    this.placement = new PlacementSvc("card");
    this.tag = new TagSvc();
    this.restart = new RestartSt({
      restart: () => send({ kind: "restartComfy" }),
      ping: () => send({ kind: "ping" }),
      onBack: () => {
        this.listing.forgetAll();
        void this.refreshForVersion();
      },
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
      file: false,
      listing: false,
      ads: false,
      placement: false,
      tag: false,
    });
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  /** called on every url change the page makes */
  onUrl(href: string): void {
    this.tag.onUrl(href);
    const ref = parseCivitaiModelUrl(href);
    if (!this.page.setRef(ref)) return;
    this.download.reset();
    this.file.reset();
    if (ref == null) return;
    void this.page.load().then(() => this.refreshForVersion());
  }

  /** points the card at another version without touching civitai's url */
  pickVersion(versionId: number): void {
    const ref = this.page.ref;
    if (ref == null || !this.page.setRef({ ...ref, versionId })) return;
    this.download.reset();
    this.file.reset();
    void this.refreshForVersion();
  }

  async refreshForVersion(): Promise<void> {
    const m = this.page.model.result;
    const v = this.page.version;
    const prefix = this.page.prefix;
    if (m == null || v == null || prefix == null) return;
    await Promise.all([
      this.library.check(),
      this.folder.load(prefix, m.tags),
      this.download.resume(m.id, v.id),
    ]);
  }
}

/** the LoRA Manager address, editable from the card, shared with the popup through storage */
export class ServerSvc {
  url = "";
  draft = "";
  isEditing = false;
  /** the user closed the auto opened popover: stays closed until the address is saved again */
  dismissed = false;
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
      this.dismissed = false;
      void this.st.refreshForVersion();
    }
  }

  toggleEditing(): void {
    if (this.isOpen) return this.close();
    this.isEditing = true;
    this.draft = this.url;
    this.saveError = null;
  }

  close(): void {
    this.isEditing = false;
    this.dismissed = true;
  }

  get lmUnreachable(): boolean {
    return this.st.library.status.error != null || this.st.folder.choices.error != null;
  }

  setDraft(v: string): void {
    this.draft = v;
  }

  /** open while editing, and on its own when LM cannot be reached until the user closes it */
  get isOpen(): boolean {
    return this.isEditing || (this.lmUnreachable && !this.dismissed);
  }

  async save(): Promise<void> {
    this.saveError = null;
    try {
      const saved = await saveLmUrl(this.draft);
      runInAction(() => {
        this.draft = saved;
        this.dismissed = false;
      });
      if (saved === this.url) void this.st.refreshForVersion();
    } catch (e) {
      runInAction(() => (this.saveError = errorMessage(e)));
    }
  }
}

/** which civitai file of the current version to download */
export class FileSvc {
  pickedId: number | null = null;

  constructor(private st: CardSt) {
    makeAutoObservable<FileSvc, "st">(this, { st: false });
  }

  reset(): void {
    this.pickedId = null;
  }

  pick(id: number): void {
    this.pickedId = id;
  }

  get files(): CivitaiFile[] {
    const v = this.st.page.version;
    return v == null ? [] : weightFiles(v);
  }

  /** the explicit pick, else the primary file (weightFiles sorts it first) */
  get picked(): CivitaiFile | null {
    return this.files.find((f) => f.id === this.pickedId) ?? this.files[0] ?? null;
  }

  label(f: CivitaiFile): string {
    return fileLabel(f);
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

  get version(): CivitaiVersion | null {
    const m = this.model.result;
    if (m == null || m.id !== this.ref?.modelId) return null;
    const wanted = this.ref.versionId;
    if (wanted == null) return m.versions[0] ?? null;
    return (
      m.versions.find((v) => v.id === wanted) ?? {
        id: wanted,
        name: `version ${wanted}`,
        baseModel: null,
        files: [],
      }
    );
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
  choices: Query<FolderSuggestion>;
  pick: FolderPick = { root: "", sub: "" };
  /** the rule tag that chose the current pick, null once edited by hand */
  via: string | null = null;
  private prefix: LmPrefix | null = null;
  private tags: string[] = [];

  constructor(private st: CardSt) {
    this.choices = new Query(() => {
      const prefix = this.prefix;
      if (prefix == null) return Promise.reject(new Error("unsupported model type"));
      return suggestFolder(prefix, this.tags, null);
    });
    makeAutoObservable<FolderSvc, "st" | "prefix" | "tags">(this, {
      st: false,
      choices: false,
      prefix: false,
      tags: false,
    });
  }

  async load(prefix: LmPrefix, tags: string[]): Promise<void> {
    this.prefix = prefix;
    this.tags = tags;
    await this.choices.run();
    runInAction(() => {
      const r = this.choices.result;
      if (r == null) return;
      this.pick = r.pick;
      this.via = r.via;
    });
  }

  setRoot(root: string): void {
    this.pick = { ...this.pick, root };
    this.via = null;
    this.remember();
  }

  setSub(sub: string): void {
    this.pick = { ...this.pick, sub: normalizeSub(sub) };
    this.via = null;
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
    if (s.kind === "done") {
      const id = this.st.page.model.result?.id;
      if (id != null) this.st.listing.forget(id);
      void this.st.library.check();
    }
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
        target: {
          modelId: m.id,
          versionId: v.id,
          prefix,
          folder: this.st.folder.pick,
          fileId: this.st.file.picked?.id ?? null,
        },
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
              file: this.markedFile(),
            },
          ];
    await setMarked(next);
  }

  /** only an explicit choice among several files is worth keeping */
  private markedFile(): { id: number; label: string } | null {
    const f = this.st.file.picked;
    return f != null && this.st.file.files.length > 1 ? { id: f.id, label: fileLabel(f) } : null;
  }

  async remove(versionId: number): Promise<void> {
    const current = await getMarked();
    const next = current.filter((i) => i.versionId !== versionId);
    if (next.length !== current.length) await setMarked(next);
  }
}

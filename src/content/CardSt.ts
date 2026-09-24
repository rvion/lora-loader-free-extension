import { makeAutoObservable, reaction, runInAction } from "mobx";

import { AdSvc } from "src/content/AdSvc.ts";
import { EditSvc } from "src/content/EditSvc.ts";
import { FocusSvc } from "src/content/FocusSvc.ts";
import { factsOf, ListingSvc } from "src/content/ListingSvc.ts";
import { PlacementSvc } from "src/content/PlacementSvc.ts";
import { RulesSvc } from "src/content/RulesSvc.ts";
import {
  fetchCivitaiModel,
  lmPrefixForCivitaiType,
  parseCivitaiModelUrl,
  type CivitaiModel,
  type CivitaiPageRef,
  type CivitaiVersion,
  type LmPrefix,
} from "src/shared/civitai.ts";
import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import { RestartSt } from "src/shared/RestartSt.ts";
import { matchRule } from "src/shared/rules.ts";
import { getSettings, onSettingsChanged, saveLmUrl } from "src/shared/storage.ts";
import { errorMessage } from "src/shared/watchDownload.ts";

/** root of the page overlay: one per tab (agent/architecture.md) */
export class CardSt {
  page: PageSvc;
  server: ServerSvc;
  restart: RestartSt;
  edit: EditSvc;
  listing: ListingSvc;
  ads: AdSvc;
  placement: PlacementSvc;
  rules: RulesSvc;
  focus: FocusSvc;
  collapsed = false;

  constructor() {
    this.page = new PageSvc();
    this.focus = new FocusSvc();
    this.rules = new RulesSvc(() => this.page.isModelPage);
    this.edit = new EditSvc();
    this.listing = new ListingSvc({
      draft: () => this.rules.draftRule,
      onStats: (s) => this.rules.setStats(s),
      focus: () => this.focus.active,
      override: (vid) => this.edit.overrides.get(vid) ?? null,
      fileFor: (vid) => this.edit.files.get(vid) ?? null,
      onEdit: (req) => void this.edit.open(req),
    });
    this.edit.link(this.listing);
    this.server = new ServerSvc(this);
    this.ads = new AdSvc();
    this.placement = new PlacementSvc("card");
    this.restart = new RestartSt({
      restart: () => send({ kind: "restartComfy" }),
      ping: () => send({ kind: "ping" }),
      onBack: () => this.listing.forgetAll(),
    });
    makeAutoObservable(this, {
      page: false,
      server: false,
      restart: false,
      edit: false,
      listing: false,
      ads: false,
      placement: false,
      rules: false,
      focus: false,
    });
    // focus and the rule being edited retarget every chip, tiles and model page row alike
    reaction(
      () => JSON.stringify([this.focus.active, this.rules.draftRule]),
      () => this.listing.refresh(),
    );
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
  }

  /** called on every url change the page makes */
  onUrl(href: string): void {
    this.rules.onUrl(href);
    const ref = parseCivitaiModelUrl(href);
    if (!this.page.setRef(ref)) return;
    this.listing.watch(ref?.modelId ?? null);
    if (ref != null) void this.page.load();
  }

  /** the rules popover on a model page: the first rule this model matches, else its version's base model */
  openRules(): Promise<void> {
    const m = this.page.model.result;
    const v = this.page.version;
    const existing =
      m == null
        ? null
        : (this.rules.rules.find((r) =>
            m.versions.some((x) => matchRule(r.cond, factsOf(m), x.baseModel)),
          ) ?? null);
    const base = v?.baseModel;
    return this.rules.open({
      existing,
      cond: base != null ? { tags: [], words: [], bases: [base], types: [] } : null,
    });
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
      this.st.listing.forgetAll();
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
    return this.st.listing.isLmDown;
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
      if (saved === this.url) this.st.listing.forgetAll();
    } catch (e) {
      runInAction(() => (this.saveError = errorMessage(e)));
    }
  }
}

/** which civitai file of the current version to download */
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
        publishedAt: null,
        files: [],
      }
    );
  }

  get prefix(): LmPrefix | null {
    const m = this.model.result;
    return m == null ? null : lmPrefixForCivitaiType(m.type);
  }

  /** quick picks for the rules editor on a model page: this model's tags and base models */
  get picks(): { tags: string[]; bases: string[] } {
    const m = this.model.result;
    if (m == null) return { tags: [], bases: [] };
    const bases = m.versions.map((v) => v.baseModel).filter((b): b is string => b != null);
    return { tags: m.tags, bases: [...new Set(bases)] };
  }

  get isModelPage(): boolean {
    return this.ref != null;
  }
}

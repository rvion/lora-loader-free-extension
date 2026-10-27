import { makeAutoObservable, reaction, runInAction } from "mobx";

import { AdSvc } from "src/content/AdSvc.ts";
import { EditSvc } from "src/content/EditSvc.ts";
import { FocusSvc } from "src/content/FocusSvc.ts";
import { factsOf, ListingSvc } from "src/content/ListingSvc.ts";
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
import { matchRule, type Rule } from "src/shared/rules.ts";
import { getSettings, onSettingsChanged, saveLmUrl } from "src/shared/storage.ts";
import { errorMessage } from "src/shared/watchDownload.ts";
import { ErrorSvc, reportError, setErrorSink } from "src/content/ErrorSvc.ts";

/** root of the page overlay: one per tab (agent/architecture.md) */
export class CardSt {
  page: PageSvc;
  server: ServerSvc;
  restart: RestartSt;
  edit: EditSvc;
  listing: ListingSvc;
  ads: AdSvc;
  rules: RulesSvc;
  focus: FocusSvc;
  errors: ErrorSvc;
  private disposers: (() => void)[] = [];

  constructor() {
    this.errors = new ErrorSvc({
      version: chrome.runtime.getManifest().version,
      url: () => location.href,
    });
    setErrorSink(this.errors);
    this.page = new PageSvc();
    this.focus = new FocusSvc();
    this.rules = new RulesSvc();
    this.edit = new EditSvc();
    this.listing = new ListingSvc({
      draft: () => this.rules.draftRule,
      onStats: (s) => this.rules.setStats(s),
      focus: () => this.focus.active,
      override: (vid) => this.edit.overrides.get(vid) ?? null,
      picksFor: (vid) => this.edit.picks.get(vid) ?? null,
      onEdit: (req) => void this.edit.open(req),
    });
    this.edit.link(this.listing);
    this.server = new ServerSvc(this);
    this.ads = new AdSvc();
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
      rules: false,
      focus: false,
      errors: false,
    });
    // focus and the rule being edited retarget every chip, tiles and model page row alike
    this.disposers.push(
      reaction(
        () => JSON.stringify([this.focus.active, this.rules.draftRule]),
        () => this.listing.refresh(),
      ),
    );
  }

  /** a newer copy of the extension took over this tab: stop, and leave nothing on the page */
  dispose(): void {
    for (const d of this.disposers) d();
    this.listing.dispose();
    this.ads.dispose();
    setErrorSink(null);
  }

  /** called on every url change the page makes */
  onUrl(href: string): void {
    this.rules.onUrl(href);
    const ref = parseCivitaiModelUrl(href);
    if (!this.page.setRef(ref)) return;
    this.listing.watch(ref?.modelId ?? null);
    if (ref != null) void this.page.load();
  }

  /** what the bar's "here" line shows: on a model page the first rule it matches, else the page's rule */
  get hereRule(): Rule | null {
    const m = this.page.model.result;
    if (!this.page.isModelPage) return this.rules.pageRule;
    if (m == null) return null;
    return (
      this.rules.rules.find((r) =>
        m.versions.some((x) => matchRule(r.cond, factsOf(m), x.baseModel)),
      ) ?? null
    );
  }

  get hasContext(): boolean {
    return this.page.isModelPage || this.rules.pageCond != null;
  }

  /** quick picks for rules and focus: this model's tags and bases, else what the page's tiles show */
  get picks(): { tags: string[]; bases: string[] } {
    if (this.page.isModelPage) return this.page.picks;
    return {
      tags: this.rules.stats.tags.map((t) => t[0]),
      bases: this.rules.stats.bases.map((b) => b[0]),
    };
  }

  openRulesHere(): Promise<void> {
    return this.page.isModelPage
      ? this.openRules()
      : this.rules.open({ cond: this.rules.pageCond, existing: this.rules.pageRule });
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
  /** chrome allows the saved address (agent/spec.md "host access") */
  hasAccess = true;

  constructor(private st: CardSt) {
    makeAutoObservable<ServerSvc, "st">(this, { st: false });
    void getSettings().then((s) => this.applySaved(s.lmUrl, false));
    onSettingsChanged((s) => this.applySaved(s.lmUrl, true));
    reaction(
      () => [this.url, this.lmUnreachable],
      () => void this.checkAccess(),
    );
  }

  get host(): string {
    try {
      return new URL(this.url).hostname;
    } catch {
      return this.url;
    }
  }

  async checkAccess(): Promise<void> {
    if (this.url === "") return;
    const ok = await send({ kind: "hostAccess", url: this.url }).catch(() => true);
    runInAction(() => (this.hasAccess = ok));
  }

  /** a content script cannot ask chrome for a host: the options page does */
  openOptions(): void {
    send({ kind: "openOptions" }).catch((e: unknown) => reportError("open the extension options", e));
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
      reportError("save the LoRA Manager address", e);
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
    if (this.model.error != null) {
      reportError(`civitai model ${id}`, this.model.error);
      runInAction(() => (this.loadedModelId = null));
    }
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

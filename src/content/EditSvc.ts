import { makeAutoObservable, observable, runInAction } from "mobx";

import { reportError } from "src/content/ErrorSvc.ts";
import type { EditRequest, ListingSvc } from "src/content/ListingSvc.ts";
import {
  defaultPicks,
  fileKey,
  lmPrefixForCivitaiType,
  sameBase,
  togglePick,
  type CivitaiVersion,
  type FilePick,
  type LmPrefix,
} from "src/shared/civitai.ts";
import type { FolderChoices } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { normalizeSub } from "src/shared/paths.ts";
import { setLastFolder, type FolderPick } from "src/shared/storage.ts";
import { errorMessage } from "src/shared/watchDownload.ts";

/** the target editor of a chip (agent/spec.md "target editor"): manual targets and file picks, for this tab */
export class EditSvc {
  req: EditRequest | null = null;
  choices: FolderChoices | null = null;
  loadError: string | null = null;
  overrides = observable.map<number, FolderPick>();
  /** by chip version id */
  picks = observable.map<number, FilePick[]>();
  /** fileKeys LoRA Manager has, for the open chip's versions */
  owned = observable.set<string>();
  private listing: ListingSvc | null = null;

  constructor() {
    makeAutoObservable<EditSvc, "listing">(this, {
      listing: false,
      overrides: false,
      picks: false,
    });
  }

  /** the listing is built after this service (it reads the overrides), then linked */
  link(listing: ListingSvc): void {
    this.listing = listing;
  }

  get prefix(): LmPrefix | null {
    const m = this.req != null ? this.listing?.modelOf(this.req.modelId) : null;
    return m != null ? lmPrefixForCivitaiType(m.type) : null;
  }

  get version() {
    const r = this.req;
    return r == null
      ? null
      : (this.listing?.modelOf(r.modelId)?.versions.find((v) => v.id === r.versionId) ?? null);
  }

  /** every version of the chip's base model, latest first */
  get versions(): CivitaiVersion[] {
    const v = this.version;
    const m = this.req != null ? this.listing?.modelOf(this.req.modelId) : null;
    return v != null && m != null ? sameBase(m.versions, v) : [];
  }

  /** what was ticked; null = nothing, the chip downloads the default */
  get explicitPicks(): FilePick[] | null {
    const v = this.version;
    return v != null ? (this.picks.get(v.id) ?? null) : null;
  }

  /** what Get downloads: the ticks, else the default */
  get currentPicks(): FilePick[] {
    const v = this.version;
    if (v == null) return [];
    return this.explicitPicks ?? defaultPicks(v);
  }

  isPicked(p: FilePick): boolean {
    return this.explicitPicks?.some((x) => fileKey(x) === fileKey(p)) === true;
  }

  togglePick(p: FilePick): void {
    const v = this.version;
    if (v == null) return;
    const next = togglePick(this.explicitPicks, p);
    if (next == null) this.picks.delete(v.id);
    else this.picks.set(v.id, next);
    this.listing?.refresh();
  }

  get modelName(): string {
    return this.req != null ? (this.listing?.modelOf(this.req.modelId)?.name ?? "") : "";
  }

  /** the target shown right now: the manual one, else what the rules give */
  get target(): FolderPick | null {
    const r = this.req;
    if (r == null) return null;
    const manual = this.overrides.get(r.versionId);
    if (manual != null) return manual;
    const t = this.listing?.targetOf(r.modelId, r.versionId);
    return t != null ? { root: t.root, sub: t.sub } : null;
  }

  get isManual(): boolean {
    return this.req != null && this.overrides.has(this.req.versionId);
  }

  async open(req: EditRequest): Promise<void> {
    this.req = req;
    this.choices = null;
    this.loadError = null;
    this.owned.clear();
    void this.loadOwned(req);
    const prefix = this.prefix;
    if (prefix == null) return;
    try {
      const c = await send({ kind: "folderChoices", prefix });
      runInAction(() => {
        if (this.req === req) this.choices = c;
      });
    } catch (e) {
      reportError("target editor folders", e);
      runInAction(() => (this.loadError = errorMessage(e)));
    }
  }

  /** which civitai files of these versions LoRA Manager has, matched by file name */
  private async loadOwned(req: EditRequest): Promise<void> {
    const have = new Set(
      this.listing?.presenceOf(req.modelId)?.versions.map((v) => v.versionId) ?? [],
    );
    try {
      await Promise.all(
        this.versions
          .filter((v) => have.has(v.id))
          .map(async (v) => {
            const s = await send({ kind: "libraryStatus", modelId: req.modelId, versionId: v.id });
            if (!s.exists) return;
            const names = new Set(s.files.map((f) => f.fileName));
            runInAction(() => {
              if (this.req !== req) return;
              for (const f of v.files)
                if (names.has(f.name)) this.owned.add(fileKey({ versionId: v.id, fileId: f.id }));
            });
          }),
      );
    } catch (e) {
      reportError("target editor library files", e);
    }
  }

  close(): void {
    this.req = null;
  }

  private setTarget(pick: FolderPick): void {
    const r = this.req;
    if (r == null) return;
    this.overrides.set(r.versionId, pick);
    const prefix = this.prefix;
    if (prefix != null) void setLastFolder(prefix, pick);
    this.listing?.refresh();
  }

  setRoot(root: string): void {
    const t = this.target;
    if (t != null) this.setTarget({ root, sub: t.sub });
  }

  setSub(sub: string): void {
    const t = this.target;
    if (t != null) this.setTarget({ root: t.root, sub: normalizeSub(sub) });
  }

  insertBase(): void {
    const t = this.target;
    const base = this.version?.baseModel;
    if (t == null || base == null) return;
    const slug = base.toLowerCase().replace(/[^a-z0-9]/g, "") || "other";
    if (!t.sub.startsWith(`${slug}/`) && t.sub !== slug)
      this.setSub(t.sub === "" ? slug : `${slug}/${t.sub}`);
  }

  resetToRule(): void {
    if (this.req == null) return;
    this.overrides.delete(this.req.versionId);
    this.listing?.refresh();
  }

  /** install here, or mark here while LoRA Manager is down */
  go(): void {
    const r = this.req;
    const listing = this.listing;
    if (r == null || listing == null) return;
    void listing.run(r.modelId, {
      kind: listing.isLmDown ? "mark" : "install",
      versionId: r.versionId,
    });
    this.close();
  }
}

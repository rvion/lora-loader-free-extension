import { makeAutoObservable, observable, runInAction } from "mobx";

import { reportError } from "src/content/ErrorSvc.ts";
import type { EditRequest, ListingSvc } from "src/content/ListingSvc.ts";
import { lmPrefixForCivitaiType, type LmPrefix } from "src/shared/civitai.ts";
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
  files = observable.map<number, number>();
  private listing: ListingSvc | null = null;

  constructor() {
    makeAutoObservable<EditSvc, "listing">(this, {
      listing: false,
      overrides: false,
      files: false,
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

  pickFile(id: number): void {
    if (this.req != null) this.files.set(this.req.versionId, id);
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

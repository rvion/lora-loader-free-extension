import { makeAutoObservable, runInAction } from "mobx";

import { PlacementSvc } from "src/content/PlacementSvc.ts";
import { parsePageTag } from "src/shared/civitai.ts";
import type { FolderChoices } from "src/shared/lmClient.ts";
import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import {
  deleteTagRule,
  getTagRules,
  onTagRulesChanged,
  saveTagRule,
  type TagRule,
} from "src/shared/storage.ts";
import { errorMessage } from "src/shared/watchDownload.ts";

/** the tag bar on tag pages: tag → root + subfolder rules (agent/spec.md "tag rules") */
export class TagSvc {
  pageTag: string | null = null;
  rules: TagRule[] = [];
  /** "" = keep the last used root */
  draftRoot = "";
  draftSub = "";
  minimized = false;
  saveError: string | null = null;
  roots: Query<FolderChoices>;
  placement = new PlacementSvc("tag");

  constructor() {
    this.roots = new Query(() => send({ kind: "folderChoices", prefix: "loras" }));
    makeAutoObservable(this, { roots: false, placement: false });
    void getTagRules().then((r) => this.setRules(r));
    onTagRulesChanged((r) => this.setRules(r));
  }

  setRules(rules: TagRule[]): void {
    this.rules = rules;
  }

  get rule(): TagRule | null {
    return this.rules.find((r) => r.tag === this.pageTag) ?? null;
  }

  onUrl(href: string): void {
    const tag = parsePageTag(href);
    if (tag === this.pageTag) return;
    this.pageTag = tag;
    this.saveError = null;
    const existing = this.rule;
    this.draftRoot = existing?.root ?? "";
    this.draftSub = existing?.sub ?? tag ?? "";
    if (tag != null && this.roots.result == null && !this.roots.isRunning) void this.roots.run();
  }

  setDraftRoot(root: string): void {
    this.draftRoot = root;
  }

  setDraftSub(sub: string): void {
    this.draftSub = sub.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  toggleMinimized(): void {
    this.minimized = !this.minimized;
  }

  get isDirty(): boolean {
    const r = this.rule;
    return r == null || (r.root ?? "") !== this.draftRoot || r.sub !== this.draftSub;
  }

  async save(): Promise<void> {
    const tag = this.pageTag;
    if (tag == null) return;
    this.saveError = null;
    try {
      await saveTagRule({
        tag,
        root: this.draftRoot === "" ? null : this.draftRoot,
        sub: this.draftSub,
      });
    } catch (e) {
      runInAction(() => (this.saveError = errorMessage(e)));
    }
  }

  async remove(): Promise<void> {
    if (this.pageTag != null) await deleteTagRule(this.pageTag);
  }
}

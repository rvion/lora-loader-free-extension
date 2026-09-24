import { makeAutoObservable, runInAction } from "mobx";

import { PlacementSvc } from "src/content/PlacementSvc.ts";
import { parsePageTag, type LmPrefix } from "src/shared/civitai.ts";
import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import {
  deleteTagRule,
  getLastFolder,
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
  /** "" only until the roots load, then always a real root */
  draftRoot = "";
  draftSub = "";
  minimized = false;
  saveError: string | null = null;
  roots: Query<AllRoots>;
  placement = new PlacementSvc("tag");

  constructor() {
    this.roots = new Query(loadAllRoots);
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
    if (tag != null) void this.loadRoots();
  }

  private async loadRoots(): Promise<void> {
    if (this.roots.result == null && !this.roots.isRunning) await this.roots.run();
    runInAction(() => {
      const r = this.roots.result;
      if (r != null && this.draftRoot === "")
        this.draftRoot = r.lastLoraRoot ?? r.byType[0]?.roots[0] ?? "";
    });
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

const TYPE_LABELS: [LmPrefix, string][] = [
  ["loras", "LoRA"],
  ["checkpoints", "Checkpoint"],
  ["embeddings", "Embedding"],
];

export type AllRoots = {
  byType: { prefix: LmPrefix; label: string; roots: string[] }[];
  /** lora subfolders, for the combobox */
  folders: string[];
  lastLoraRoot: string | null;
};

/** every root LoRA Manager knows, grouped by type; a type that fails is skipped, not fatal */
async function loadAllRoots(): Promise<AllRoots> {
  const [choices, last] = await Promise.all([
    Promise.all(
      TYPE_LABELS.map(([prefix]) => send({ kind: "folderChoices", prefix }).catch(() => null)),
    ),
    getLastFolder("loras"),
  ]);
  const byType = TYPE_LABELS.flatMap(([prefix, label], i) => {
    const c = choices[i];
    return c != null && c.roots.length > 0 ? [{ prefix, label, roots: c.roots }] : [];
  });
  if (byType.length === 0) throw new Error("LoRA Manager lists no model root");
  const loraRoots = byType.find((t) => t.prefix === "loras")?.roots ?? [];
  return {
    byType,
    folders: choices[0]?.folders ?? [],
    lastLoraRoot: last != null && loraRoots.includes(last.root) ? last.root : null,
  };
}

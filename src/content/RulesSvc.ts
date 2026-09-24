import { makeAutoObservable, runInAction } from "mobx";

import { PlacementSvc } from "src/content/PlacementSvc.ts";
import type { LmPrefix } from "src/shared/civitai.ts";
import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import {
  defaultSub,
  emptyCond,
  isEmptyCond,
  newRuleId,
  pageContext,
  sameCond,
  type CondField,
  type Rule,
  type RuleCond,
} from "src/shared/rules.ts";
import {
  deleteRule,
  getLastFolder,
  getRules,
  moveRuleUp,
  onRulesChanged,
  saveRule,
} from "src/shared/storage.ts";
import { errorMessage } from "src/shared/watchDownload.ts";

export type Draft = { id: string | null; cond: RuleCond; root: string; sub: string };

/** what the listing saw on screen, for "matches N of M" and the quick picks */
export type PageStats = {
  total: number;
  matched: number;
  tags: [string, number][];
  bases: [string, number][];
};

/** where the editor opens from: the page's context and the saved rule it maps to */
export type EditorStart = { cond: RuleCond | null; existing: Rule | null };

/** rules, the editor draft and the rules strip (agent/spec.md "rules") */
export class RulesSvc {
  rules: Rule[] = [];
  href = "";
  isOpen = false;
  draft: Draft | null = null;
  minimized = false;
  saveError: string | null = null;
  stats: PageStats = { total: 0, matched: 0, tags: [], bases: [] };
  roots: Query<AllRoots>;
  placement = new PlacementSvc("tag");

  constructor(private isModelPage: () => boolean) {
    this.roots = new Query(loadAllRoots);
    makeAutoObservable<RulesSvc, "isModelPage">(this, {
      roots: false,
      placement: false,
      isModelPage: false,
    });
    void getRules().then((r) => this.setRules(r));
    onRulesChanged((r) => this.setRules(r));
  }

  setRules(rules: Rule[]): void {
    this.rules = rules;
  }

  onUrl(href: string): void {
    if (href !== this.href) this.href = href;
  }

  /** every render pass reports: only a real change may re-render the strip */
  setStats(s: PageStats): void {
    if (JSON.stringify(s) !== JSON.stringify(this.stats)) this.stats = s;
  }

  /** the tag page, the search, the url filters */
  get pageCond(): RuleCond | null {
    return pageContext(this.href);
  }

  /** the saved rule for exactly this page's context */
  get pageRule(): Rule | null {
    const c = this.pageCond;
    return c == null ? null : (this.rules.find((r) => sameCond(r.cond, c)) ?? null);
  }

  /** the bar is on every page; on a model page the card's row is the bar */
  get stripVisible(): boolean {
    return !this.isModelPage();
  }

  /** the rule being edited, saved or not: tried first everywhere while the popover is open */
  get draftRule(): Rule | null {
    const d = this.draft;
    if (!this.isOpen || d == null || isEmptyCond(d.cond) || d.root === "") return null;
    return { id: d.id ?? "draft", cond: d.cond, root: d.root, sub: d.sub };
  }

  get isDirty(): boolean {
    const d = this.draft;
    if (d == null) return false;
    const saved = d.id == null ? null : this.rules.find((r) => r.id === d.id);
    return (
      saved == null ||
      !sameCond(saved.cond, d.cond) ||
      (saved.root ?? "") !== d.root ||
      saved.sub !== d.sub
    );
  }

  async open(start: EditorStart): Promise<void> {
    this.isOpen = true;
    this.saveError = null;
    if (this.roots.result == null && !this.roots.isRunning) await this.roots.run();
    runInAction(() => {
      if (start.existing != null) this.loadRule(start.existing);
      else
        this.draft = {
          id: null,
          cond: start.cond ?? emptyCond(),
          root: this.defaultRoot,
          sub: start.cond != null ? defaultSub(start.cond) : "",
        };
    });
  }

  close(): void {
    this.isOpen = false;
    this.draft = null;
  }

  private get defaultRoot(): string {
    const r = this.roots.result;
    return r?.lastLoraRoot ?? r?.byType[0]?.roots[0] ?? "";
  }

  private loadRule(r: Rule): void {
    this.draft = {
      id: r.id,
      cond: {
        tags: [...r.cond.tags],
        words: [...r.cond.words],
        bases: [...r.cond.bases],
        types: [...r.cond.types],
      },
      root: r.root ?? this.defaultRoot,
      sub: r.sub,
    };
  }

  edit(id: string): void {
    const r = this.rules.find((x) => x.id === id);
    if (r != null) this.loadRule(r);
    this.saveError = null;
  }

  newRule(): void {
    this.draft = { id: null, cond: emptyCond(), root: this.defaultRoot, sub: "" };
    this.saveError = null;
  }

  addCond(field: Exclude<CondField, "types">, raw: string): void {
    const d = this.draft;
    const v = field === "bases" ? raw.trim() : raw.trim().toLowerCase();
    if (d == null || v === "" || d.cond[field].some((x) => x.toLowerCase() === v.toLowerCase()))
      return;
    d.cond[field] = [...d.cond[field], v];
  }

  removeCond(field: CondField, value: string): void {
    const d = this.draft;
    if (d == null) return;
    if (field === "types") d.cond.types = d.cond.types.filter((t) => t !== value);
    else d.cond[field] = d.cond[field].filter((x) => x !== value);
  }

  toggleType(t: LmPrefix): void {
    const d = this.draft;
    if (d == null) return;
    d.cond.types = d.cond.types.includes(t)
      ? d.cond.types.filter((x) => x !== t)
      : [...d.cond.types, t];
  }

  setRoot(root: string): void {
    if (this.draft != null) this.draft.root = root;
  }

  setSub(sub: string): void {
    if (this.draft != null) this.draft.sub = sub.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  /** puts `{base}/` in front of the subfolder, once */
  insertBase(): void {
    const d = this.draft;
    if (d != null && !d.sub.includes("{base}")) d.sub = d.sub === "" ? "{base}" : `{base}/${d.sub}`;
  }

  toggleMinimized(): void {
    this.minimized = !this.minimized;
  }

  async save(): Promise<void> {
    const d = this.draft;
    if (d == null) return;
    this.saveError = null;
    if (isEmptyCond(d.cond)) {
      this.saveError = "add at least one condition";
      return;
    }
    const id = d.id ?? newRuleId();
    try {
      await saveRule({ id, cond: d.cond, root: d.root === "" ? null : d.root, sub: d.sub });
      runInAction(() => {
        if (this.draft === d) d.id = id;
      });
    } catch (e) {
      runInAction(() => (this.saveError = errorMessage(e)));
    }
  }

  async remove(id: string): Promise<void> {
    await deleteRule(id);
    runInAction(() => {
      if (this.draft?.id === id) this.draft.id = null;
    });
  }

  moveUp(id: string): Promise<void> {
    return moveRuleUp(id);
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

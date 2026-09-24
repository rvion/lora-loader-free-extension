import { makeAutoObservable, runInAction } from "mobx";

import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import { RestartSt } from "src/shared/RestartSt.ts";
import {
  DEFAULT_LM_URL,
  getMarked,
  getSettings,
  onMarkedChanged,
  getTagRules,
  onSettingsChanged,
  onTagRulesChanged,
  setTagRules,
  type TagRule,
  saveLmUrl,
  setMarked,
  type MarkedItem,
} from "src/shared/storage.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

/** a marked item handed to LoRA Manager: it left the marked list, the popup still shows it while open */
export type Launched = { item: MarkedItem; state: DownloadState };

export class PopupSt {
  urlDraft = DEFAULT_LM_URL;
  savedUrl = DEFAULT_LM_URL;
  test: Query<string>;
  restart: RestartSt;
  marked: MarkedItem[] = [];
  launched: Launched[] = [];
  rules: TagRule[] = [];
  isLaunching = false;
  saveError: string | null = null;

  constructor() {
    this.test = new Query(() => send({ kind: "lmVersion", url: this.urlDraft }));
    this.restart = new RestartSt({
      restart: () => send({ kind: "restartComfy" }),
      ping: () => send({ kind: "ping" }),
      onBack: () => void this.test.run(),
    });
    makeAutoObservable(this, { test: false, restart: false });
    void this.init();
  }

  private async init(): Promise<void> {
    const [settings, marked] = await Promise.all([getSettings(), getMarked()]);
    runInAction(() => {
      this.urlDraft = settings.lmUrl;
      this.savedUrl = settings.lmUrl;
      this.marked = marked;
    });
    onMarkedChanged((items) => this.setMarkedItems(items));
    onSettingsChanged((s) => this.setSaved(s.lmUrl));
    const rules = await getTagRules();
    runInAction(() => (this.rules = rules));
    onTagRulesChanged((r) => this.setRules(r));
  }

  setMarkedItems(items: MarkedItem[]): void {
    this.marked = items;
  }

  setRules(rules: TagRule[]): void {
    this.rules = rules;
  }

  /** order is priority: the first matching rule wins */
  async moveRuleUp(tag: string): Promise<void> {
    const rules = await getTagRules();
    const i = rules.findIndex((r) => r.tag === tag);
    const prev = rules[i - 1];
    const cur = rules[i];
    if (i <= 0 || prev == null || cur == null) return;
    await setTagRules([...rules.slice(0, i - 1), cur, prev, ...rules.slice(i + 1)]);
  }

  async deleteRule(tag: string): Promise<void> {
    await setTagRules((await getTagRules()).filter((r) => r.tag !== tag));
  }

  setUrlDraft(url: string): void {
    this.urlDraft = url;
  }

  get isDirty(): boolean {
    return this.urlDraft.trim() !== this.savedUrl;
  }

  async saveUrl(): Promise<void> {
    this.saveError = null;
    try {
      const url = await saveLmUrl(this.urlDraft);
      runInAction(() => {
        this.savedUrl = url;
        this.urlDraft = url;
      });
    } catch (e) {
      runInAction(() => (this.saveError = errorMessage(e)));
      return;
    }
    await this.test.run();
  }

  setSaved(url: string): void {
    this.savedUrl = url;
    this.urlDraft = url;
  }

  async unmark(versionId: number): Promise<void> {
    await setMarked((await getMarked()).filter((i) => i.versionId !== versionId));
  }

  async downloadAll(): Promise<void> {
    this.isLaunching = true;
    try {
      for (const item of await getMarked()) await this.launch(item);
    } finally {
      runInAction(() => (this.isLaunching = false));
    }
  }

  private async launch(item: MarkedItem): Promise<void> {
    const entry: Launched = { item, state: { kind: "starting" } };
    runInAction(() => this.launched.push(entry));
    const row = this.launched[this.launched.length - 1];
    if (row == null) return;
    try {
      const r = await send({
        kind: "startDownload",
        target: {
          modelId: item.modelId,
          versionId: item.versionId,
          prefix: item.prefix,
          folder: item.folder,
          fileId: item.file?.id ?? null,
        },
      });
      await this.unmark(item.versionId);
      watchDownload({
        modelId: item.modelId,
        versionId: item.versionId,
        downloadId: r.downloadId,
        isAlive: () => true,
        onState: (s) => this.setRowState(row, s),
      });
    } catch (e) {
      this.setRowState(row, { kind: "failed", message: errorMessage(e) });
    }
  }

  setRowState(row: Launched, s: DownloadState): void {
    row.state = s;
  }
}

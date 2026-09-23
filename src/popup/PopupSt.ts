import { makeAutoObservable, runInAction } from "mobx";

import { send } from "src/shared/messages.ts";
import { Query } from "src/shared/Query.ts";
import {
  DEFAULT_LM_URL,
  getMarked,
  getSettings,
  onMarkedChanged,
  setMarked,
  setSettings,
  type MarkedItem,
} from "src/shared/storage.ts";
import { errorMessage, watchDownload, type DownloadState } from "src/shared/watchDownload.ts";

/** a marked item handed to LoRA Manager: it left the marked list, the popup still shows it while open */
export type Launched = { item: MarkedItem; state: DownloadState };

export class PopupSt {
  urlDraft = DEFAULT_LM_URL;
  savedUrl = DEFAULT_LM_URL;
  test: Query<string>;
  marked: MarkedItem[] = [];
  launched: Launched[] = [];
  isLaunching = false;

  constructor() {
    this.test = new Query(() => send({ kind: "lmVersion", url: this.urlDraft }));
    makeAutoObservable(this, { test: false });
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
  }

  setMarkedItems(items: MarkedItem[]): void {
    this.marked = items;
  }

  setUrlDraft(url: string): void {
    this.urlDraft = url;
  }

  get isDirty(): boolean {
    return this.urlDraft.trim() !== this.savedUrl;
  }

  async saveUrl(): Promise<void> {
    const url = this.urlDraft.trim();
    await setSettings({ lmUrl: url });
    runInAction(() => {
      this.savedUrl = url;
      this.urlDraft = url;
    });
    await this.test.run();
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

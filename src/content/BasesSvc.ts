import { makeAutoObservable, runInAction } from "mobx";

import { reportError } from "src/content/ErrorSvc.ts";
import { fetchCivitaiBaseModels } from "src/shared/civitai.ts";
import { getKnownBases, setKnownBases } from "src/shared/storage.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** every base model civitai knows, kept a day (agent/spec.md "every base model") */
export class BasesSvc {
  all: string[] = [];

  constructor() {
    makeAutoObservable(this);
    void this.load();
  }

  private async load(): Promise<void> {
    const kept = await getKnownBases();
    if (kept != null) runInAction(() => (this.all = kept.names));
    if (kept != null && Date.now() - kept.at < DAY_MS) return;
    try {
      const names = await fetchCivitaiBaseModels(location.origin);
      runInAction(() => (this.all = names));
      await setKnownBases({ names, at: Date.now() });
    } catch (e) {
      reportError("base model list", e);
    }
  }
}

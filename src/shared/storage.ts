import type { LmPrefix } from "src/shared/civitai.ts";

export const DEFAULT_LM_URL = "http://127.0.0.1:8188";

export type Settings = { lmUrl: string };

export type FolderPick = { root: string; sub: string };

export type MarkedItem = {
  modelId: number;
  versionId: number;
  modelName: string;
  versionName: string;
  prefix: LmPrefix;
  folder: FolderPick;
};

export async function getSettings(): Promise<Settings> {
  const got = await chrome.storage.sync.get("settings");
  const s = got.settings as Partial<Settings> | undefined;
  return { lmUrl: s?.lmUrl ?? DEFAULT_LM_URL };
}

export async function setSettings(p: Settings): Promise<void> {
  await chrome.storage.sync.set({ settings: p });
}

export async function getLastFolder(prefix: LmPrefix): Promise<FolderPick | null> {
  const key = `lastFolder:${prefix}`;
  const got = await chrome.storage.local.get(key);
  return (got[key] as FolderPick | undefined) ?? null;
}

export async function setLastFolder(prefix: LmPrefix, pick: FolderPick): Promise<void> {
  await chrome.storage.local.set({ [`lastFolder:${prefix}`]: pick });
}

export async function getMarked(): Promise<MarkedItem[]> {
  const got = await chrome.storage.local.get("marked");
  return (got.marked as MarkedItem[] | undefined) ?? [];
}

export async function setMarked(items: MarkedItem[]): Promise<void> {
  await chrome.storage.local.set({ marked: items });
}

/** fires with the new list whenever any surface changes it */
export function onMarkedChanged(cb: (items: MarkedItem[]) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes.marked != null)
      cb((changes.marked.newValue as MarkedItem[] | undefined) ?? []);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

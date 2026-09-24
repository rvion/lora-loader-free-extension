import type { LmPrefix } from "src/shared/civitai.ts";
import { normalizeBaseUrl } from "src/shared/lmClient.ts";

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
  /** absent on items marked before file picking existed */
  file?: { id: number; label: string } | null;
};

export async function getSettings(): Promise<Settings> {
  const got = await chrome.storage.sync.get("settings");
  const s = got.settings as Partial<Settings> | undefined;
  return { lmUrl: s?.lmUrl ?? DEFAULT_LM_URL };
}

/** accepts a host, ip:port or full url, stores the normalized origin, throws on garbage */
export async function saveLmUrl(raw: string): Promise<string> {
  let lmUrl: string;
  try {
    lmUrl = normalizeBaseUrl(raw);
  } catch {
    throw new Error(`not a valid address: ${raw}`);
  }
  await chrome.storage.sync.set({ settings: { lmUrl } satisfies Settings });
  return lmUrl;
}

export function onSettingsChanged(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "sync" || changes.settings == null) return;
    const s = changes.settings.newValue as Partial<Settings> | undefined;
    cb({ lmUrl: s?.lmUrl ?? DEFAULT_LM_URL });
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
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

export type ScreenPos = { x: number; y: number };

export type SavedPlacement = { mode: "dock" | "free"; pos: ScreenPos | null };

export type OverlayId = "card" | "tag";

export async function getPlacement(id: OverlayId): Promise<SavedPlacement | null> {
  const key = `placement:${id}`;
  const got = await chrome.storage.local.get(key);
  return (got[key] as SavedPlacement | undefined) ?? null;
}

export async function setPlacement(id: OverlayId, p: SavedPlacement): Promise<void> {
  await chrome.storage.local.set({ [`placement:${id}`]: p });
}

export type TagRule = {
  /** lowercased civitai tag */
  tag: string;
  /** null: keep the last used root */
  root: string | null;
  sub: string;
};

export async function getTagRules(): Promise<TagRule[]> {
  const got = await chrome.storage.local.get("tagRules");
  return (got.tagRules as TagRule[] | undefined) ?? [];
}

export async function setTagRules(rules: TagRule[]): Promise<void> {
  await chrome.storage.local.set({ tagRules: rules });
}

/** replaces the rule for that tag in place, or appends it (lowest priority) */
export async function saveTagRule(rule: TagRule): Promise<void> {
  const rules = await getTagRules();
  const i = rules.findIndex((r) => r.tag === rule.tag);
  await setTagRules(i >= 0 ? rules.map((r, j) => (j === i ? rule : r)) : [...rules, rule]);
}

export async function deleteTagRule(tag: string): Promise<void> {
  await setTagRules((await getTagRules()).filter((r) => r.tag !== tag));
}

/** fires with the new list whenever any surface changes it */
export function onMarkedChanged(cb: (items: MarkedItem[]) => void): () => void {
  return onLocalChanged<MarkedItem[]>("marked", (v) => cb(v ?? []));
}

export function onTagRulesChanged(cb: (rules: TagRule[]) => void): () => void {
  return onLocalChanged<TagRule[]>("tagRules", (v) => cb(v ?? []));
}

function onLocalChanged<T>(key: string, cb: (v: T | undefined) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    const c = changes[key];
    if (area === "local" && c != null) cb(c.newValue as T | undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

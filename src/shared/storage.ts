import { fileKey, type LmPrefix } from "src/shared/civitai.ts";
import { normalizeBaseUrl } from "src/shared/lmClient.ts";
import {
  emptyCond,
  missingCategoryRules,
  newRuleId,
  type Rule,
  type RuleCond,
} from "src/shared/rules.ts";

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

/** one marked row per file (fileKey) */
export function markedKey(i: MarkedItem): string {
  return fileKey({ versionId: i.versionId, fileId: i.file?.id ?? null });
}

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
  const key = `placement2:${id}`;
  const got = await chrome.storage.local.get(key);
  return (got[key] as SavedPlacement | undefined) ?? null;
}

export async function setPlacement(id: OverlayId, p: SavedPlacement): Promise<void> {
  await chrome.storage.local.set({ [`placement2:${id}`]: p });
}

/** the tag rules of earlier versions, read once to migrate them */
type LegacyTagRule = { tag: string; root: string | null; sub: string };

/** rules in priority order. the first read migrates the legacy tag rules */
export async function getRules(): Promise<Rule[]> {
  const got = await chrome.storage.local.get(["rules2", "tagRules"]);
  const rules = got.rules2 as Rule[] | undefined;
  if (rules != null) return rules;
  const legacy = (got.tagRules as LegacyTagRule[] | undefined) ?? [];
  const migrated = legacy.map((r): Rule => ({
    id: newRuleId(),
    cond: { ...emptyCond(), tags: [r.tag] },
    root: r.root,
    sub: r.sub,
  }));
  await chrome.storage.local.set({ rules2: migrated });
  return migrated;
}

/** appends the civitai category rules that are missing; returns how many were added */
export async function addCategoryRules(): Promise<number> {
  const rules = await getRules();
  const add = missingCategoryRules(rules);
  if (add.length > 0) await setRules([...rules, ...add]);
  return add.length;
}

/** the first run seeds the category rules once; deleting them later is respected */
export async function seedCategoryRulesOnce(): Promise<void> {
  const got = await chrome.storage.local.get("categoriesSeeded");
  if (got.categoriesSeeded === true) return;
  await addCategoryRules();
  await chrome.storage.local.set({ categoriesSeeded: true });
}

export async function setRules(rules: Rule[]): Promise<void> {
  await chrome.storage.local.set({ rules2: rules });
}

/** replaces the rule with that id in place, or appends it (lowest priority) */
export async function saveRule(rule: Rule): Promise<void> {
  const rules = await getRules();
  const i = rules.findIndex((r) => r.id === rule.id);
  await setRules(i >= 0 ? rules.map((r, j) => (j === i ? rule : r)) : [...rules, rule]);
}

export async function deleteRule(id: string): Promise<void> {
  await setRules((await getRules()).filter((r) => r.id !== id));
}

export async function moveRuleUp(id: string): Promise<void> {
  const rules = await getRules();
  const i = rules.findIndex((r) => r.id === id);
  const prev = rules[i - 1];
  const cur = rules[i];
  if (i <= 0 || prev == null || cur == null) return;
  await setRules([...rules.slice(0, i - 1), cur, prev, ...rules.slice(i + 1)]);
}

/** agent/spec.md "focus": which models get install chips */
export type Focus = { enabled: boolean; cond: RuleCond };

export async function getFocus(): Promise<Focus> {
  const got = await chrome.storage.local.get("focus");
  return (got.focus as Focus | undefined) ?? { enabled: false, cond: emptyCond() };
}

export async function setFocus(f: Focus): Promise<void> {
  await chrome.storage.local.set({ focus: f });
}

export function onFocusChanged(cb: (f: Focus) => void): () => void {
  return onLocalChanged<Focus>("focus", (v) => cb(v ?? { enabled: false, cond: emptyCond() }));
}

/** fires with the new list whenever any surface changes it */
export function onMarkedChanged(cb: (items: MarkedItem[]) => void): () => void {
  return onLocalChanged<MarkedItem[]>("marked", (v) => cb(v ?? []));
}

export function onRulesChanged(cb: (rules: Rule[]) => void): () => void {
  return onLocalChanged<Rule[]>("rules2", (v) => cb(v ?? []));
}

function onLocalChanged<T>(key: string, cb: (v: T | undefined) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    const c = changes[key];
    if (area === "local" && c != null) cb(c.newValue as T | undefined);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

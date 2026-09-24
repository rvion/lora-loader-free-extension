import type { LmPrefix } from "src/shared/civitai.ts";
import { send } from "src/shared/messages.ts";
import { getLastFolder, getTagRules, type FolderPick, type TagRule } from "src/shared/storage.ts";

export type FolderSuggestion = {
  pick: FolderPick;
  /** the rule tag that chose it, null when it is the last used folder */
  via: string | null;
  roots: string[];
  folders: string[];
};

export type ResolveInput = {
  roots: string[];
  modelTags: string[];
  pageTag: string | null;
  rules: TagRule[];
  last: FolderPick | null;
  /** the version's civitai base model, for `{base}` in a rule's subfolder */
  baseModel: string | null;
};

/** agent/spec.md "tag rules": page tag, then first matching rule, then last used */
export function resolveFolder(p: ResolveInput): { pick: FolderPick; via: string | null } {
  const tags = new Set(p.modelTags.map((t) => t.toLowerCase()));
  const rule =
    (p.pageTag != null ? p.rules.find((r) => r.tag === p.pageTag) : undefined) ??
    p.rules.find((r) => tags.has(r.tag));
  const usable = (root: string | null | undefined): root is string =>
    root != null && p.roots.includes(root);
  const root = usable(rule?.root)
    ? rule.root
    : usable(p.last?.root)
      ? p.last.root
      : (p.roots[0] ?? "");
  const sub = rule != null ? applyBase(rule.sub, p.baseModel) : (p.last?.sub ?? "");
  return { pick: { root, sub }, via: rule?.tag ?? null };
}

/** "Krea 2" → "krea2", "Flux.1 D" → "flux1d"; "other" when civitai names none */
export function baseSlug(baseModel: string | null): string {
  const slug = (baseModel ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return slug !== "" ? slug : "other";
}

export function applyBase(sub: string, baseModel: string | null): string {
  return sub.replaceAll("{base}", baseSlug(baseModel));
}

/** the tag bar's unsaved draft wins over the saved rule for its tag, so the page previews it live */
export function withDraft(rules: TagRule[], draft: TagRule | null): TagRule[] {
  return draft == null ? rules : [draft, ...rules.filter((r) => r.tag !== draft.tag)];
}

export async function suggestFolder(
  prefix: LmPrefix,
  modelTags: string[],
  pageTag: string | null,
  baseModel: string | null,
): Promise<FolderSuggestion> {
  const [choices, rules, last] = await Promise.all([
    send({ kind: "folderChoices", prefix }),
    getTagRules(),
    getLastFolder(prefix),
  ]);
  const r = resolveFolder({ roots: choices.roots, modelTags, pageTag, rules, last, baseModel });
  return { ...r, roots: choices.roots, folders: choices.folders };
}

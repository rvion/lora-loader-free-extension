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
  const sub = rule != null ? rule.sub : (p.last?.sub ?? "");
  return { pick: { root, sub }, via: rule?.tag ?? null };
}

export async function suggestFolder(
  prefix: LmPrefix,
  modelTags: string[],
  pageTag: string | null,
): Promise<FolderSuggestion> {
  const [choices, rules, last] = await Promise.all([
    send({ kind: "folderChoices", prefix }),
    getTagRules(),
    getLastFolder(prefix),
  ]);
  const r = resolveFolder({ roots: choices.roots, modelTags, pageTag, rules, last });
  return { ...r, roots: choices.roots, folders: choices.folders };
}

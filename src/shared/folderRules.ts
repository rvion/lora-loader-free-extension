import type { LmPrefix } from "src/shared/civitai.ts";
import { send } from "src/shared/messages.ts";
import { matchRule, type ModelFacts, type Rule } from "src/shared/rules.ts";
import { getLastFolder, getRules, type FolderPick } from "src/shared/storage.ts";

export type FolderSuggestion = {
  pick: FolderPick;
  /** the rule that chose it, null when none matched */
  via: Rule | null;
  roots: string[];
  folders: string[];
};

export type ResolveInput = {
  roots: string[];
  model: ModelFacts;
  /** the version's civitai base model: a condition, and `{base}` in the subfolder */
  baseModel: string | null;
  /** priority order; a draft being edited goes first (withDraft) */
  rules: Rule[];
  last: FolderPick | null;
};

/** agent/spec.md "rules": first matching rule, else the last root with no subfolder */
export function resolveFolder(p: ResolveInput): { pick: FolderPick; via: Rule | null } {
  const rule = p.rules.find((r) => matchRule(r.cond, p.model, p.baseModel)) ?? null;
  const usable = (root: string | null | undefined): root is string =>
    root != null && p.roots.includes(root);
  const root = usable(rule?.root)
    ? rule.root
    : usable(p.last?.root)
      ? p.last.root
      : (p.roots[0] ?? "");
  // never the last subfolder: it was built for another model (krea2/styles for an illustrious one)
  const sub = rule != null ? applyBase(rule.sub, p.baseModel) : "";
  return { pick: { root, sub }, via: rule };
}

/** "Krea 2" → "krea2", "Flux.1 D" → "flux1d"; "other" when civitai names none */
export function baseSlug(baseModel: string | null): string {
  const slug = (baseModel ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return slug !== "" ? slug : "other";
}

export function applyBase(sub: string, baseModel: string | null): string {
  return sub.replaceAll("{base}", baseSlug(baseModel));
}

/** the rule being edited goes first, replacing its saved self, so the page previews it live */
export function withDraft(rules: Rule[], draft: Rule | null): Rule[] {
  return draft == null ? rules : [draft, ...rules.filter((r) => r.id !== draft.id)];
}

export async function suggestFolder(
  prefix: LmPrefix,
  model: ModelFacts,
  baseModel: string | null,
  draft: Rule | null,
): Promise<FolderSuggestion> {
  const [choices, rules, last] = await Promise.all([
    send({ kind: "folderChoices", prefix }),
    getRules(),
    getLastFolder(prefix),
  ]);
  const r = resolveFolder({
    roots: choices.roots,
    model,
    baseModel,
    rules: withDraft(rules, draft),
    last,
  });
  return { ...r, roots: choices.roots, folders: choices.folders };
}

import type { LmPrefix } from "src/shared/civitai.ts";

/** agent/spec.md "rules": every filled field must match, any value inside a field is enough */
export type RuleCond = {
  tags: string[];
  /** matched inside the model name or any of its tags */
  words: string[];
  bases: string[];
  types: LmPrefix[];
};

export type Rule = {
  id: string;
  cond: RuleCond;
  /** null only on rules migrated from a tag rule saved without a root */
  root: string | null;
  sub: string;
};

export type CondField = keyof RuleCond;

export type ModelFacts = { name: string; tags: string[]; prefix: LmPrefix | null };

export const emptyCond = (): RuleCond => ({ tags: [], words: [], bases: [], types: [] });

export const isEmptyCond = (c: RuleCond): boolean =>
  c.tags.length + c.words.length + c.bases.length + c.types.length === 0;

const low = (s: string) => s.trim().toLowerCase();

export function matchRule(cond: RuleCond, m: ModelFacts, baseModel: string | null): boolean {
  if (isEmptyCond(cond)) return false;
  const tags = m.tags.map(low);
  const name = low(m.name);
  if (cond.tags.length > 0 && !cond.tags.some((t) => tags.includes(low(t)))) return false;
  if (
    cond.words.length > 0 &&
    !cond.words.some((w) => name.includes(low(w)) || tags.some((t) => t.includes(low(w))))
  )
    return false;
  if (cond.bases.length > 0 && !cond.bases.some((b) => low(b) === low(baseModel ?? "")))
    return false;
  if (cond.types.length > 0 && (m.prefix == null || !cond.types.includes(m.prefix))) return false;
  return true;
}

/** what the page is about: a tag page, a search, url filters. null when nothing */
export function pageContext(href: string): RuleCond | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const c = emptyCond();
  const pathTag = /^\/tag\/([^/?#]+)/.exec(url.pathname)?.[1];
  if (pathTag != null) c.tags.push(low(decodeURIComponent(pathTag)));
  if (url.pathname === "/models" || url.pathname.startsWith("/search/models")) {
    for (const [k, v] of url.searchParams) {
      if (v.trim() === "") continue;
      if (/^tags?$/i.test(k)) c.tags.push(low(v));
      else if (/^base_?models?$/i.test(k)) c.bases.push(v.trim());
      else if (/^(query|q)$/i.test(k) && url.pathname.startsWith("/search/")) c.words.push(low(v));
    }
  }
  const uniq = (xs: string[]) => [...new Set(xs)];
  const out = { tags: uniq(c.tags), words: uniq(c.words), bases: uniq(c.bases), types: [] };
  return isEmptyCond(out) ? null : out;
}

export function sameCond(a: RuleCond, b: RuleCond): boolean {
  const key = (xs: string[]) => [...xs].map(low).sort().join("\u0000");
  return (["tags", "words", "bases", "types"] as const).every((f) => key(a[f]) === key(b[f]));
}

const TYPE_NAMES: Record<LmPrefix, string> = {
  loras: "LoRA",
  checkpoints: "Checkpoint",
  embeddings: "Embedding",
};

export const FIELD_LABELS: Record<CondField, string> = {
  tags: "tag",
  words: "has",
  bases: "base",
  types: "type",
};

/** "tag style · base Krea 2" */
export function summarizeCond(c: RuleCond): string {
  const parts: string[] = [];
  if (c.tags.length > 0) parts.push(`tag ${c.tags.join(" | ")}`);
  if (c.words.length > 0) parts.push(`has ${c.words.join(" | ")}`);
  if (c.bases.length > 0) parts.push(`base ${c.bases.join(" | ")}`);
  if (c.types.length > 0) parts.push(`type ${c.types.map((t) => TYPE_NAMES[t]).join(" | ")}`);
  return parts.length > 0 ? parts.join(" · ") : "no condition";
}

export function typeName(t: LmPrefix): string {
  return TYPE_NAMES[t];
}

/** the default subfolder of a rule made from a page: `{base}/<tag or query>` */
export function defaultSub(c: RuleCond): string {
  const name = c.tags[0] ?? c.words[0] ?? "";
  const slug = name
    .replace(/[\\/]+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
  return slug !== "" ? `{base}/${slug}` : "{base}";
}

export function newRuleId(): string {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

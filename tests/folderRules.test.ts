import { expect, test } from "bun:test";

import { baseSlug, resolveFolder, withDraft, type ResolveInput } from "src/shared/folderRules.ts";
import { emptyCond, type Rule } from "src/shared/rules.ts";

const rule = (
  id: string,
  cond: Partial<Rule["cond"]>,
  sub: string,
  root: string | null = "/m/loras",
): Rule => ({
  id,
  cond: { ...emptyCond(), ...cond },
  root,
  sub,
});

const base: ResolveInput = {
  roots: ["/m/loras", "/big/loras"],
  model: { name: "PixieSprite HoMM 5", tags: ["sprite", "fantasy", "character"], prefix: "loras" },
  baseModel: "Illustrious",
  rules: [],
  last: { root: "/big/loras", sub: "krea2/styles" },
};

test("no rule matches: last root, no subfolder (never a folder built for another model)", () => {
  expect(resolveFolder(base)).toEqual({ pick: { root: "/big/loras", sub: "" }, via: null });
});

test("first matching rule in list order wins, {base} resolved", () => {
  const rules = [
    rule("a", { tags: ["style"] }, "{base}/styles"),
    rule("b", { words: ["sprite"] }, "{base}/sprites"),
  ];
  const r = resolveFolder({ ...base, rules });
  expect(r.pick).toEqual({ root: "/m/loras", sub: "illustrious/sprites" });
  expect(r.via?.id).toBe("b");
});

test("a rule root foreign to this model type falls back, its subfolder still applies", () => {
  const rules = [rule("a", { words: ["sprite"] }, "sprites")];
  const r = resolveFolder({ ...base, roots: ["/m/checkpoints"], last: null, rules });
  expect(r.pick).toEqual({ root: "/m/checkpoints", sub: "sprites" });
});

test("{base} becomes the folder safe base model", () => {
  expect(baseSlug("Krea 2")).toBe("krea2");
  expect(baseSlug("Flux.1 D")).toBe("flux1d");
  expect(baseSlug(null)).toBe("other");
});

test("the draft goes first and replaces its saved self", () => {
  const saved = [rule("a", { tags: ["style"] }, "old"), rule("b", { tags: ["x"] }, "b")];
  const draft = rule("a", { tags: ["style"] }, "{base}/styles");
  expect(withDraft(saved, draft).map((r) => [r.id, r.sub])).toEqual([
    ["a", "{base}/styles"],
    ["b", "b"],
  ]);
  expect(withDraft(saved, null)).toBe(saved);
});

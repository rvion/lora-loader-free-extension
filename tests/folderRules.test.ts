import { expect, test } from "bun:test";

import { parsePageTag } from "src/shared/civitai.ts";
import { baseSlug, resolveFolder, withDraft, type ResolveInput } from "src/shared/folderRules.ts";

const base: ResolveInput = {
  roots: ["/m/loras", "/big/loras"],
  modelTags: [],
  pageTag: null,
  rules: [],
  last: { root: "/big/loras", sub: "misc" },
  baseModel: null,
};

test("no rule: last used folder", () => {
  expect(resolveFolder(base)).toEqual({ pick: { root: "/big/loras", sub: "misc" }, via: null });
});

test("first rule in list order matching a model tag wins", () => {
  const rules = [
    { tag: "style", root: null, sub: "style" },
    { tag: "concept", root: "/m/loras", sub: "concept" },
  ];
  const r = resolveFolder({ ...base, modelTags: ["Concept", "style"], rules });
  expect(r).toEqual({ pick: { root: "/big/loras", sub: "style" }, via: "style" });
});

test("on a tag page the page tag rule wins over list order", () => {
  const rules = [
    { tag: "style", root: null, sub: "style" },
    { tag: "concept", root: "/m/loras", sub: "concept" },
  ];
  const r = resolveFolder({ ...base, modelTags: ["style", "concept"], pageTag: "concept", rules });
  expect(r).toEqual({ pick: { root: "/m/loras", sub: "concept" }, via: "concept" });
});

test("a rule root foreign to this model type falls back, its subfolder still applies", () => {
  const rules = [{ tag: "concept", root: "/m/loras", sub: "concept" }];
  const r = resolveFolder({
    ...base,
    roots: ["/m/checkpoints"],
    last: null,
    modelTags: ["concept"],
    rules,
  });
  expect(r).toEqual({ pick: { root: "/m/checkpoints", sub: "concept" }, via: "concept" });
});

test("page tag comes from ?tag= on /models and from /tag/<name>", () => {
  expect(parsePageTag("https://civitai.red/models?tag=concept")).toBe("concept");
  expect(parsePageTag("https://civitai.com/tag/Anime%20Style")).toBe("anime style");
  expect(parsePageTag("https://civitai.com/models/123?tag=concept")).toBeNull();
  expect(parsePageTag("https://civitai.com/models")).toBeNull();
});

test("{base} in a rule becomes the folder safe base model", () => {
  expect(baseSlug("Krea 2")).toBe("krea2");
  expect(baseSlug("Flux.1 D")).toBe("flux1d");
  expect(baseSlug(null)).toBe("other");
  const rules = [{ tag: "style", root: "/m/loras", sub: "{base}/styles" }];
  expect(resolveFolder({ ...base, modelTags: ["style"], rules, baseModel: "Anima" }).pick.sub).toBe(
    "anima/styles",
  );
});

test("the tag bar draft replaces the saved rule for its tag", () => {
  const saved = [
    { tag: "style", root: "/m/loras", sub: "old" },
    { tag: "concept", root: null, sub: "c" },
  ];
  expect(withDraft(saved, { tag: "style", root: "/big/loras", sub: "{base}/styles" })).toEqual([
    { tag: "style", root: "/big/loras", sub: "{base}/styles" },
    { tag: "concept", root: null, sub: "c" },
  ]);
  expect(withDraft(saved, null)).toBe(saved);
});

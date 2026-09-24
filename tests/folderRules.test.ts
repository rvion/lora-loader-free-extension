import { expect, test } from "bun:test";

import { parsePageTag } from "src/shared/civitai.ts";
import { resolveFolder, type ResolveInput } from "src/shared/folderRules.ts";

const base: ResolveInput = {
  roots: ["/m/loras", "/big/loras"],
  modelTags: [],
  pageTag: null,
  rules: [],
  last: { root: "/big/loras", sub: "misc" },
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

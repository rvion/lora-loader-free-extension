import { expect, test } from "bun:test";

import {
  defaultSub,
  emptyCond,
  matchRule,
  missingCategoryRules,
  pageContext,
  sameCond,
  summarizeCond,
  type RuleCond,
} from "src/shared/rules.ts";

const cond = (c: Partial<RuleCond>): RuleCond => ({ ...emptyCond(), ...c });
const pixie = {
  name: "PixieSprite - Heroes of Might and Magic 5",
  tags: ["sprite", "fantasy", "homm 5"],
  prefix: "loras" as const,
};

test("filled fields AND together, values inside a field OR", () => {
  expect(matchRule(cond({ tags: ["style", "sprite"] }), pixie, "Illustrious")).toBe(true);
  expect(matchRule(cond({ tags: ["sprite"], bases: ["Krea 2"] }), pixie, "Illustrious")).toBe(
    false,
  );
  expect(
    matchRule(cond({ tags: ["sprite"], bases: ["krea 2", "illustrious"] }), pixie, "Illustrious"),
  ).toBe(true);
  expect(matchRule(cond({ types: ["checkpoints"] }), pixie, null)).toBe(false);
});

test("name/tag has matches inside the name or inside a tag", () => {
  expect(matchRule(cond({ words: ["heroes of might"] }), pixie, null)).toBe(true);
  expect(matchRule(cond({ words: ["homm"] }), pixie, null)).toBe(true);
  expect(matchRule(cond({ words: ["monster"] }), pixie, null)).toBe(false);
});

test("a rule with no condition never matches", () => {
  expect(matchRule(emptyCond(), pixie, null)).toBe(false);
});

test("page context: tag pages, searches with their query, url filters", () => {
  expect(pageContext("https://civitai.red/models?tag=style")).toEqual(cond({ tags: ["style"] }));
  expect(pageContext("https://civitai.red/tag/Anime%20Style")).toEqual(
    cond({ tags: ["anime style"] }),
  );
  expect(pageContext("https://civitai.red/search/models?sortBy=models_v9&query=Monster")).toEqual(
    cond({ words: ["monster"] }),
  );
  expect(
    pageContext("https://civitai.red/search/models?query=sprite&baseModel=Illustrious"),
  ).toEqual(cond({ words: ["sprite"], bases: ["Illustrious"] }));
  expect(pageContext("https://civitai.red/models")).toBeNull();
  expect(pageContext("https://civitai.red/models/123?tag=x")).toBeNull();
});

test("same conditions ignore order and case; summaries and default subfolders read well", () => {
  expect(sameCond(cond({ tags: ["a", "B"] }), cond({ tags: ["b", "a"] }))).toBe(true);
  expect(sameCond(cond({ tags: ["a"] }), cond({ tags: ["a"], bases: ["x"] }))).toBe(false);
  expect(summarizeCond(cond({ tags: ["style"], bases: ["Krea 2", "Anima"] }))).toBe(
    "tag style · base Krea 2 | Anima",
  );
  expect(defaultSub(cond({ words: ["monster girl"] }))).toBe("{base}/monster-girl");
  expect(defaultSub(emptyCond())).toBe("{base}");
});

test("category rules: one per civitai category, {base}/<category>, never duplicated", () => {
  const seeded = missingCategoryRules([]);
  expect(seeded).toHaveLength(14);
  expect(seeded.map((r) => [r.cond.tags[0], r.sub]).slice(0, 5)).toEqual([
    ["character", "{base}/character"],
    ["style", "{base}/style"],
    ["concept", "{base}/concept"],
    ["clothing", "{base}/clothing"],
    ["base model", "{base}/base-model"],
  ]);
  expect(seeded.every((r) => r.root == null)).toBe(true);
  const kept = seeded.filter((r) => r.cond.tags[0] !== "style");
  expect(missingCategoryRules(kept).map((r) => r.cond.tags[0])).toEqual(["style"]);
});

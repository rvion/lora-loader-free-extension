import { expect, test } from "bun:test";

import { badgeText, chunk, unknownIds } from "src/content/BadgeSvc.ts";

test("only ids neither known nor in flight are fetched, once each", () => {
  const cards = [{ modelId: 1 }, { modelId: 2 }, { modelId: 2 }, { modelId: 3 }, { modelId: 4 }];
  expect(unknownIds(cards, new Map([[1, null]]), new Set([3]))).toEqual([2, 4]);
});

test("ids are sent in chunks", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("badge shows the version count when several are in the library", () => {
  expect(badgeText({ modelType: "lora", versionCount: 1 })).toBe("✓ LM");
  expect(badgeText({ modelType: "lora", versionCount: 3 })).toBe("✓ LM ×3");
});

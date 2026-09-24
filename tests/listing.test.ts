import { expect, test } from "bun:test";

import { chipFor, chunk, unknownIds } from "src/content/ListingSvc.ts";

test("only ids neither known nor in flight are fetched, once each", () => {
  const cards = [{ modelId: 1 }, { modelId: 2 }, { modelId: 2 }, { modelId: 3 }, { modelId: 4 }];
  expect(unknownIds(cards, new Map([[1, null]]), new Set([3]))).toEqual([2, 4]);
});

test("ids are sent in chunks", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chip: nothing until LM answered, install when absent, count when several", () => {
  expect(chipFor(undefined, undefined)).toBeNull();
  expect(chipFor(null, undefined)).toMatchObject({ cls: "lmf-hot", text: "⬇ Install" });
  expect(
    chipFor({ modelType: "lora", versionCount: 1, fileNames: ["a.safetensors"] }, undefined),
  ).toMatchObject({
    text: "✓ LM",
    title: "In your LoRA Manager library (lora):\na.safetensors",
  });
  expect(chipFor({ modelType: "lora", versionCount: 3, fileNames: [] }, undefined)?.text).toBe(
    "✓ LM ×3",
  );
});

test("chip: a running job wins over presence, a failure is retryable", () => {
  expect(chipFor(null, { kind: "running", percent: 41.6, stage: null })?.text).toBe("⬇ 42%");
  expect(chipFor(null, { kind: "running", percent: 0, stage: "queued" })?.text).toBe("⬇ queued");
  expect(chipFor(null, { kind: "failed", message: "early access" })).toMatchObject({
    cls: "lmf-danger",
    title: "early access (click to retry)",
  });
});

import { expect, test } from "bun:test";

import { chipFor, chunk, tipLines, unknownIds } from "src/content/ListingSvc.ts";
import type { CivitaiVersion } from "src/shared/civitai.ts";

const have = (...ids: number[]) => ({
  modelType: "lora",
  versions: ids.map((id) => ({ versionId: id, name: `v${id}`, fileName: `m${id}.safetensors` })),
});
const newer: CivitaiVersion = {
  id: 9,
  name: "v9",
  baseModel: "Krea 2",
  publishedAt: "2026-09-20",
  files: [],
};

test("only ids neither known nor in flight are fetched, once each", () => {
  const cards = [{ modelId: 1 }, { modelId: 2 }, { modelId: 2 }, { modelId: 3 }, { modelId: 4 }];
  expect(unknownIds(cards, new Map([[1, null]]), new Set([3]))).toEqual([2, 4]);
});

test("ids are sent in chunks", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chip: nothing until LM answered, install when absent, count when several", () => {
  expect(chipFor(undefined, undefined)).toBeNull();
  expect(chipFor(null, undefined)).toEqual({ cls: "lmf-hot", text: "⬇ Install" });
  expect(chipFor(have(1), undefined)?.text).toBe("✓ LM");
  expect(chipFor(have(1, 2, 3), undefined)?.text).toBe("✓ LM ×3");
});

test("chip: a newer version beats ✓ LM", () => {
  expect(chipFor(have(1), undefined, newer)).toEqual({ cls: "lmf-hot", text: "⬆ NEWER VERSION" });
});

test("chip: a running job wins over presence, a failure is its own state", () => {
  expect(chipFor(null, { kind: "running", percent: 41.6, stage: null })?.text).toBe("⬇ 42%");
  expect(chipFor(have(1), { kind: "running", percent: 0, stage: "queued" })?.text).toBe("⬇ queued");
  expect(chipFor(null, { kind: "failed", message: "early access" })?.cls).toBe("lmf-danger");
});

test("tooltip: each local version with where it is, then the newer one", () => {
  const lines = tipLines(
    { modelId: 1, presence: have(1), remote: null, newer, job: null },
    new Map([[1, ["loras › krea2/styles / m1.safetensors"]]]),
  );
  expect(lines.map((l) => l.text)).toEqual([
    "In your library (lora)",
    "v1",
    "  loras › krea2/styles / m1.safetensors",
    "⬆ Newer on Civitai: v9 · Krea 2 (click to install)",
  ]);
});

test("tooltip: paths not fetched yet read as locating", () => {
  const lines = tipLines(
    { modelId: 1, presence: have(1), remote: null, newer: null, job: null },
    undefined,
  );
  expect(lines[2]).toEqual({ text: "  locating…", cls: "muted" });
});

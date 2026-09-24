import { expect, test } from "bun:test";

import { chipsFor, chunk, tipLines, unknownIds, type Target } from "src/content/ListingSvc.ts";
import type { CivitaiModel, CivitaiVersion } from "src/shared/civitai.ts";
import type { DownloadState } from "src/shared/watchDownload.ts";

const ver = (id: number, baseModel: string, publishedAt: string): CivitaiVersion => ({
  id,
  name: `v${id}`,
  baseModel,
  publishedAt,
  files: [],
});
const model = (...versions: CivitaiVersion[]): CivitaiModel => ({
  id: 1,
  name: "m",
  type: "LORA",
  tags: [],
  versions,
});
const have = (...ids: number[]) => ({
  modelType: "lora",
  versions: ids.map((id) => ({ versionId: id, name: `v${id}`, fileName: `m${id}.safetensors` })),
});
const noJobs = new Map<number, DownloadState>();
const target = (v: CivitaiVersion): Target => ({
  root: "/m/loras",
  rootLabel: "loras",
  sub: `${v.baseModel?.toLowerCase()}/styles`,
});

// the screenshot case: one model, versions for Krea 2, Anima and Illustrious
const kai = model(
  ver(10, "Krea 2", "2026-09-20"),
  ver(11, "Anima", "2026-09-10"),
  ver(12, "Illustrious", "2026-09-01"),
);

test("only ids neither known nor in flight are fetched, once each", () => {
  const cards = [{ modelId: 1 }, { modelId: 2 }, { modelId: 2 }, { modelId: 3 }, { modelId: 4 }];
  expect(unknownIds(cards, new Map([[1, null]]), new Set([3]))).toEqual([2, 4]);
});

test("ids are sent in chunks", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("no chip before LM answers; stand ins before civitai answers", () => {
  expect(chipsFor({ presence: undefined, remote: kai, jobs: noJobs, target })).toEqual([]);
  expect(chipsFor({ presence: null, remote: null, jobs: noJobs, target })).toEqual([
    { cls: "lmf-hot", text: "⬇ Install", install: null },
  ]);
  expect(chipsFor({ presence: have(10, 11), remote: null, jobs: noJobs, target })[0]?.text).toBe(
    "✓ LM ×2",
  );
});

test("one chip per base model says exactly which one you have", () => {
  const chips = chipsFor({ presence: have(10), remote: kai, jobs: noJobs, target });
  expect(chips.map((c) => [c.text, c.install ?? "-", c.target?.sub ?? "-"])).toEqual([
    ["✓ Krea 2", "-", "-"],
    ["⬇ Anima", 11, "anima/styles"],
    ["⬇ Illustrious", 12, "illustrious/styles"],
  ]);
});

test("a later version of a base you have is flagged newer and installs that one", () => {
  const m = model(ver(20, "Krea 2", "2026-09-01"), ver(21, "Krea 2", "2026-09-20"));
  expect(chipsFor({ presence: have(20), remote: m, jobs: noJobs, target })).toEqual([
    { cls: "lmf-hot", text: "⬆ NEWER Krea 2", install: 21 },
  ]);
});

test("jobs show on their base chip; past four bases a +N chip", () => {
  const jobs = new Map<number, DownloadState>([
    [11, { kind: "running", percent: 41.6, stage: null }],
  ]);
  expect(chipsFor({ presence: null, remote: kai, jobs, target })[1]?.text).toBe("⬇ Anima 42%");
  const many = model(...["A", "B", "C", "D", "E", "F"].map((b, i) => ver(30 + i, b, "2026-09-01")));
  const chips = chipsFor({ presence: null, remote: many, jobs: noJobs, target });
  expect(chips).toHaveLength(5);
  expect(chips[4]).toEqual({ cls: "lmf-more", text: "+2" });
});

test("tooltip: local versions with their place, then one line per base", () => {
  const lines = tipLines(
    {
      modelId: 1,
      presence: have(10),
      groups: [
        {
          base: "Krea 2",
          latest: ver(10, "Krea 2", "2026-09-20"),
          have: ver(10, "Krea 2", "2026-09-20"),
        },
        { base: "Anima", latest: ver(11, "Anima", "2026-09-10"), have: null },
      ],
      jobs: noJobs,
      target,
    },
    new Map([[10, ["loras › krea2/styles / m10.safetensors"]]]),
  );
  expect(lines.map((l) => l.text)).toEqual([
    "In your library (lora)",
    "v10 · Krea 2",
    "  loras › krea2/styles / m10.safetensors",
    "✓ Krea 2: up to date (v10)",
    "⬇ Anima: v11 not installed → loras › anima/styles",
  ]);
});

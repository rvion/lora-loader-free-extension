import { expect, test } from "bun:test";

import {
  actKey,
  chipsFor,
  chunk,
  nextPassDelay,
  pageStats,
  parseAct,
  tipLines,
  unknownIds,
  type Chip,
  type Target,
} from "src/content/ListingSvc.ts";
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

const WAIT: Chip = { cls: "lmf-more lmf-wait", text: "", spin: true };

// why we think it is actually a bug, and not just meaning spec should change: agent/spec.md "listing cards" says a card is never bare while data is on its way
test("a spinner pill while LM or civitai is still answering", () => {
  expect(chipsFor({ presence: undefined, remote: kai, jobs: noJobs, target })).toEqual([WAIT]);
  expect(chipsFor({ presence: undefined, remote: undefined, jobs: noJobs, target })).toEqual([
    WAIT,
  ]);
  const focus = { tags: [], words: [], bases: ["Illustrious"], types: [] };
  expect(chipsFor({ presence: null, remote: undefined, jobs: noJobs, target, focus })).toEqual([
    WAIT,
  ]);
  expect(
    chipsFor({ presence: undefined, remote: undefined, jobs: noJobs, target, mode: "mark" }),
  ).toEqual([WAIT]);
});

test("LM unreachable: an offline pill carrying the error, never a spinner", () => {
  expect(
    chipsFor({ presence: undefined, remote: kai, jobs: noJobs, target, lmError: "timed out" }),
  ).toEqual([{ cls: "lmf-more lmf-off", text: "LM offline", title: "timed out" }]);
});

test("no spinner once the data is in; stand ins before civitai answers", () => {
  expect(chipsFor({ presence: null, remote: null, jobs: noJobs, target })).toEqual([
    { cls: "lmf-hot", text: "", act: { kind: "install", versionId: null }, actLabel: "Get" },
  ]);
  expect(chipsFor({ presence: have(10, 11), remote: null, jobs: noJobs, target })[0]?.text).toBe(
    "✓ LM ×2",
  );
});

test("one chip per base model says exactly which one you have", () => {
  const chips = chipsFor({ presence: have(10), remote: kai, jobs: noJobs, target });
  expect(
    chips.map((c) => [c.actLabel ?? c.text, c.act?.versionId ?? "-", c.target?.sub ?? "-"]),
  ).toEqual([
    ["✓ Krea 2", "-", "-"],
    ["Get Anima", 11, "anima/styles"],
    ["Get Illustrious", 12, "illustrious/styles"],
  ]);
});

test("a later version of a base you have is flagged newer and installs that one", () => {
  const m = model(ver(20, "Krea 2", "2026-09-01"), ver(21, "Krea 2", "2026-09-20"));
  expect(chipsFor({ presence: have(20), remote: m, jobs: noJobs, target })).toEqual([
    {
      cls: "lmf-hot",
      text: "→ v21",
      act: { kind: "install", versionId: 21 },
      actLabel: "Update Krea 2",
      target: { root: "/m/loras", rootLabel: "loras", sub: "krea 2/styles" },
      editVersion: 21,
    },
  ]);
});

test("jobs show on their base chip; past four bases a +N chip", () => {
  const jobs = new Map<number, DownloadState>([
    [11, { kind: "running", percent: 41.6, stage: null }],
  ]);
  expect(chipsFor({ presence: null, remote: kai, jobs, target })[1]?.text).toBe("Anima 42%");
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

test("page stats: matches of the draft, and the tags and bases seen, most frequent first", () => {
  const style = { ...model(ver(1, "Krea 2", "2026-09-01")), tags: ["style", "anime"] };
  const other = { ...model(ver(2, "Anima", "2026-09-01")), id: 2, tags: ["style"] };
  const draft = {
    id: "d",
    cond: { tags: ["style"], words: [], bases: ["Anima"], types: [] },
    root: "/r",
    sub: "",
  };
  expect(pageStats([style, other, null], draft)).toEqual({
    total: 3,
    matched: 1,
    tags: [
      ["style", 2],
      ["anime", 1],
    ],
    bases: [
      ["Krea 2", 1],
      ["Anima", 1],
    ],
  });
});

test("focus hides install chips of other bases, never what you have", () => {
  const focus = { tags: [], words: [], bases: ["Illustrious"], types: [] };
  const chips = chipsFor({ presence: have(10), remote: kai, jobs: noJobs, target, focus });
  expect(chips.map((c) => c.actLabel ?? c.text)).toEqual([
    "✓ Krea 2",
    "Get Illustrious",
    "+1 unfocused",
  ]);
  expect(chipsFor({ presence: null, remote: null, jobs: noJobs, target, focus })).toEqual([]);
});

test("lm down on a model page: every base becomes a mark chip, marked ones unmark", () => {
  const chips = chipsFor({
    presence: undefined,
    remote: kai,
    jobs: noJobs,
    target,
    mode: "mark",
    isMarked: (v) => v === 11,
  });
  expect(chips.map((c) => [c.actLabel, c.text])).toEqual([
    ["Mark Krea 2", ""],
    ["Unmark Anima", "★ marked"],
    ["Mark Illustrious", ""],
  ]);
});

test("a chip's click action survives the dom round trip", () => {
  for (const a of [
    { kind: "install", versionId: 12 },
    { kind: "install", versionId: null },
    { kind: "unmark", versionId: 3 },
  ] as const)
    expect(parseAct(actKey(a))).toEqual(a);
});

test("a manual target is carried by the chip", () => {
  const manual = (v: CivitaiVersion): Target => ({ ...target(v), sub: "mine", manual: true });
  expect(
    chipsFor({ presence: null, remote: kai, jobs: noJobs, target: manual })[0]?.target,
  ).toEqual({
    root: "/m/loras",
    rootLabel: "loras",
    sub: "mine",
    manual: true,
  });
});

test("what focus hides is counted in a last grey chip, tiles and model page alike", () => {
  const focus = { tags: [], words: [], bases: ["Illustrious"], types: [] };
  expect(
    chipsFor({ presence: null, remote: kai, jobs: noJobs, target, focus }).map(
      (c) => c.actLabel ?? c.text,
    ),
  ).toEqual(["Get Illustrious", "+2 unfocused"]);
  const onModelPage = chipsFor({
    presence: null,
    remote: kai,
    jobs: noJobs,
    target,
    focus,
    max: Infinity,
  });
  expect(onModelPage.at(-1)).toEqual({ cls: "lmf-more", text: "+2 unfocused" });
  const marking = chipsFor({
    presence: undefined,
    remote: kai,
    jobs: noJobs,
    target,
    focus,
    mode: "mark",
  });
  expect(marking.map((c) => c.actLabel ?? c.text)).toEqual(["Mark Illustrious", "+2 unfocused"]);
});

// why we think it is actually a bug, and not just meaning spec should change: agent/spec.md says the first pass after a quiet page runs at once, and a fixed 300 ms debounce delays every first paint
test("the first pass after a quiet page runs at once, a burst waits out the debounce", () => {
  expect(nextPassDelay(0, 10_000)).toBe(0);
  expect(nextPassDelay(10_000, 10_100)).toBe(200);
});

test("the tooltip says what a pending or offline card is waiting on", () => {
  const base = { modelId: 1, presence: null, groups: [], jobs: noJobs, target };
  expect(tipLines({ ...base, pending: "Waiting for LoRA Manager…" }, undefined)).toEqual([
    { text: "Waiting for LoRA Manager…", cls: "muted" },
  ]);
});

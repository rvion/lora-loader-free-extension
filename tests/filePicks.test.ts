import { expect, test } from "bun:test";

import { chipsFor, type Target } from "src/content/ListingSvc.ts";
import {
  defaultPicks,
  fileKey,
  picksLabel,
  type CivitaiFile,
  type CivitaiModel,
  type CivitaiVersion,
  type FilePick,
} from "src/shared/civitai.ts";
import type { LibraryStatus } from "src/shared/lmClient.ts";
import { isFileDone, type DownloadState } from "src/shared/watchDownload.ts";

const file = (id: number, fp: string, sizeKB: number, primary = false): CivitaiFile => ({
  id,
  name: `krea2Anime_${fp}_${id}.safetensors`,
  type: "Model",
  sizeKB,
  primary,
  fp,
  size: null,
  format: "SafeTensor",
});

// Krea 2 Anime as civitai serves it: v1.4 in three variants, primary bf16 first
const v14: CivitaiVersion = {
  id: 3307085,
  name: "v1.4",
  baseModel: "Krea 2",
  publishedAt: "2026-09-08",
  files: [
    file(3192558, "bf16", 25667318.0078125, true),
    file(3192632, "int4", 7868674.709960938),
    file(3192778, "int8", 13803778.84765625),
  ],
};
const v10: CivitaiVersion = {
  id: 3000000,
  name: "v1.0",
  baseModel: "Krea 2",
  publishedAt: "2026-08-01",
  files: [file(2900000, "fp16", 12582912, true)],
};
const krea: CivitaiModel = {
  id: 2910309,
  name: "Krea 2 Anime",
  type: "Checkpoint",
  tags: [],
  versions: [v14, v10],
};
const target = (): Target => ({ root: "/ckpt", rootLabel: "checkpoints", sub: "krea2/styles" });
const noJobs = new Map<string, DownloadState>();

test("nothing picked = the latest version's primary file", () => {
  expect(defaultPicks(v14)).toEqual([{ versionId: 3307085, fileId: 3192558 }]);
  expect(fileKey({ versionId: 1, fileId: null })).toBe("1:");
});

test("the chip names the file Get will download, its size, and that there are others", () => {
  const [chip] = chipsFor({ presence: null, remote: krea, jobs: noJobs, target });
  expect(chip?.actLabel).toBe("Get Krea 2");
  expect(chip?.files).toEqual({ text: "bf16 · 24.5 GB · 1 of 4", check: true });
});

test("several picks, across versions: count and total size, ×N on the button", () => {
  const picks: FilePick[] = [
    { versionId: 3307085, fileId: 3192778 },
    { versionId: 3307085, fileId: 3192632 },
  ];
  const [chip] = chipsFor({
    presence: null,
    remote: krea,
    jobs: noJobs,
    target,
    picks: () => picks,
  });
  expect(chip?.actLabel).toBe("Get Krea 2 ×2");
  expect(chip?.files?.text).toBe("2 files · 20.7 GB · 2 of 4");
  expect(picksLabel([{ versionId: 3000000, fileId: 2900000 }], krea.versions, v14)).toBe(
    "v1.0 fp16 · 12.0 GB · 1 of 4",
  );
});

test("a one file version says its size, not framed for checking", () => {
  const solo: CivitaiModel = { ...krea, versions: [v10] };
  const [chip] = chipsFor({ presence: null, remote: solo, jobs: noJobs, target });
  expect(chip?.files).toEqual({ text: "fp16 · 12.0 GB", check: false });
});

test("a running download of any picked file shows on its chip", () => {
  const jobs = new Map<string, DownloadState>([
    ["3307085:3192778", { kind: "running", percent: 12.2, stage: null }],
  ]);
  const [chip] = chipsFor({ presence: null, remote: krea, jobs, target });
  expect(chip?.text).toBe("Krea 2 12%");
});

test("a chip you have still opens the variants", () => {
  const presence = {
    modelType: "checkpoint",
    versions: [{ versionId: 3307085, name: "v1.4", fileName: "x.safetensors" }],
  };
  const [chip] = chipsFor({ presence, remote: krea, jobs: noJobs, target });
  expect(chip?.text).toBe("✓ Krea 2");
  expect(chip?.files).toEqual({ text: "", check: false });
  expect(chip?.editVersion).toBe(3307085);
});

// why we think it is actually a bug, and not just meaning spec should change: with two variants of one version, the first one landing makes the version exist, and the second watcher must not call itself done at 100% before its own file is in
test("a file is done when its own name is in the library, not just its version", () => {
  const running100 = { kind: "running", percent: 100, stage: null } as const;
  const status: LibraryStatus = {
    exists: true,
    modelType: "checkpoint",
    files: [{ fileName: "a.safetensors", filePath: "/c/a.safetensors" }],
  };
  expect(isFileDone(running100, status, "b.safetensors")).toBe(false);
  expect(isFileDone(running100, status, "a.safetensors")).toBe(true);
  expect(isFileDone({ kind: "unknown" }, status, "b.safetensors")).toBe(true);
  expect(isFileDone(running100, { exists: false }, null)).toBe(false);
  expect(isFileDone(running100, status, null)).toBe(true);
});

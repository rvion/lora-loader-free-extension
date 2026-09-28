import { expect, test } from "bun:test";

import { chipsFor, type Target } from "src/content/ListingSvc.ts";
import {
  defaultPicks,
  fileKey,
  picksLabel,
  togglePick,
  type CivitaiFile,
  type CivitaiModel,
  type CivitaiVersion,
  type FilePick,
} from "src/shared/civitai.ts";
import {
  alreadyInLibrary,
  ownsFile,
  type LibraryStatus,
  type LocalFile,
} from "src/shared/lmClient.ts";
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
  sha256: null,
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
const INT4_SHA = "d5433a9adb2602a2a56e020e5ba5e6b8338ebc08b150ed04f890593a4b066bb8";
const INT8_SHA = "2e27778c8fd349dae9d9ae97e473d55fee944e0822d510802de5cfa30adb752f";
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

// why we think it is actually a bug, and not just meaning spec should change: LoRA Manager names a file krea2Anime_v14_3192632 while civitai's page data names it krea_2_anime_v1.4_int4_convrot, so a name match never saw the int4 as installed; the civitai file id is the one key both sides share
test("a file is done, and had, by its civitai file id, whatever its name", () => {
  const running100 = { kind: "running", percent: 100, stage: null } as const;
  const int4 = { id: 3192632, sha256: INT4_SHA };
  const int8 = { id: 3192778, sha256: INT8_SHA };
  const status: LibraryStatus = {
    exists: true,
    modelType: "checkpoint",
    files: [
      {
        fileId: 3192632,
        fileName: "krea2Anime_v14_3192632.safetensors",
        filePath: "D:/m/krea_2_anime_v1.4_int4_convrot.safetensors",
        sha256: null,
      },
    ],
  };
  expect(isFileDone(running100, status, int4)).toBe(true);
  expect(isFileDone(running100, status, int8)).toBe(false);
  expect(isFileDone({ kind: "unknown" }, status, int8)).toBe(true);
  expect(isFileDone(running100, { exists: false }, null)).toBe(false);
  expect(isFileDone(running100, status, null)).toBe(true);
});

// why we think it is actually a bug, and not just meaning spec should change: after a LoRA Manager restart check-model-exists answers fileId null for every file, and the three names (civitai api krea2Anime_v14_int4, LM krea2Anime_v14_3192632, disk krea_2_anime_v1.4_int4_convrot) never agree, so the int4 read as not installed; its SHA256 is the same on both sides
test("a local file LoRA Manager could not map to an id is matched by its SHA256", () => {
  const files: LocalFile[] = [
    {
      fileId: null,
      fileName: "krea_2_anime_v1.4_int4_convrot",
      filePath: "D:/wsp1/models/diffusion_models/krea_2_anime_v1.4_int4_convrot.safetensors",
      sha256: INT4_SHA,
    },
  ];
  expect(ownsFile(files, { id: 3192632, sha256: INT4_SHA })).toBe(true);
  expect(ownsFile(files, { id: 3192778, sha256: INT8_SHA })).toBe(false);
  expect(ownsFile(files, { id: 3192778, sha256: null })).toBe(false);
});

// why we think it is actually a bug, and not just meaning spec should change: ticking int4 and int8 also downloaded the pre ticked bf16 (24.5 GB), a file never chosen; agent/spec.md says Get downloads what you picked
test("the first tick replaces the default, it never adds to it", () => {
  const int4 = { versionId: 3307085, fileId: 3192632 };
  const int8 = { versionId: 3307085, fileId: 3192778 };
  expect(togglePick(null, int4)).toEqual([int4]);
  expect(togglePick([int4], int8)).toEqual([int4, int8]);
  expect(togglePick([int4], int4)).toBeNull();
});

// why we think it is actually a bug, and not just meaning spec should change: LoRA Manager refusing a file because it is already there means you have it, the chip must not say failed
test("an already there answer from LoRA Manager is recognised", () => {
  expect(
    alreadyInLibrary(
      "LoRA Manager download: File 'krea2Anime_v14_3192778.safetensors' from model version 3307085 already exists in checkpoint library",
    ),
  ).toBe(true);
  expect(
    alreadyInLibrary("LoRA Manager download: Model version already exists in lora library"),
  ).toBe(true);
  expect(alreadyInLibrary("LoRA Manager download: HTTP 500")).toBe(false);
});

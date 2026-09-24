import { expect, test } from "bun:test";

import {
  fileLabel,
  lmPrefixForCivitaiType,
  modelIdFromHref,
  parseCivitaiModel,
  parseCivitaiModelUrl,
  weightFiles,
  type CivitaiFile,
} from "src/shared/civitai.ts";

test("model page url with and without a version", () => {
  expect(
    parseCivitaiModelUrl("https://civitai.com/models/12345/some-lora?modelVersionId=678"),
  ).toEqual({
    modelId: 12345,
    versionId: 678,
  });
  expect(parseCivitaiModelUrl("https://www.civitai.com/models/12345")).toEqual({
    modelId: 12345,
    versionId: null,
  });
  expect(parseCivitaiModelUrl("https://civitai.red/models/9?modelVersionId=abc")).toEqual({
    modelId: 9,
    versionId: null,
  });
});

test("non model pages are ignored", () => {
  expect(parseCivitaiModelUrl("https://civitai.com/images/123")).toBeNull();
  expect(parseCivitaiModelUrl("https://civitai.com/models")).toBeNull();
  expect(parseCivitaiModelUrl("https://evil.com/models/123")).toBeNull();
  expect(parseCivitaiModelUrl("not a url")).toBeNull();
});

test("civitai types map to lora manager prefixes", () => {
  expect(lmPrefixForCivitaiType("LORA")).toBe("loras");
  expect(lmPrefixForCivitaiType("LoCon")).toBe("loras");
  expect(lmPrefixForCivitaiType("DoRA")).toBe("loras");
  expect(lmPrefixForCivitaiType("Checkpoint")).toBe("checkpoints");
  expect(lmPrefixForCivitaiType("TextualInversion")).toBe("embeddings");
  expect(lmPrefixForCivitaiType("Workflows")).toBeNull();
});

test("model answer keeps id, name, type and versions", () => {
  const m = parseCivitaiModel({
    id: 1,
    name: "x",
    type: "LORA",
    modelVersions: [{ id: 2, name: "v1" }, { bad: 1 }],
  });
  expect(m).toEqual({
    id: 1,
    name: "x",
    type: "LORA",
    tags: [],
    versions: [{ id: 2, name: "v1", baseModel: null, files: [] }],
  });
  expect(() => parseCivitaiModel({ error: "nope" })).toThrow();
});

test("model card links of every shape give the model id", () => {
  expect(modelIdFromHref("/models/123/some-slug?modelVersionId=9")).toBe(123);
  expect(modelIdFromHref("https://civitai.com/models/77")).toBe(77);
  expect(modelIdFromHref("/models/5#reviews")).toBe(5);
  expect(modelIdFromHref("/models")).toBeNull();
  expect(modelIdFromHref("/user/models/5")).toBeNull();
  expect(modelIdFromHref("https://evil.com/models/5")).toBeNull();
});

const file = (p: Partial<CivitaiFile>): CivitaiFile => ({
  id: 1,
  name: "x.safetensors",
  type: "Model",
  sizeKB: null,
  primary: false,
  fp: null,
  size: null,
  format: null,
  ...p,
});

test("weight files keep only weights, primary first", () => {
  const files = weightFiles({
    id: 1,
    name: "v1",
    baseModel: null,
    files: [
      file({ id: 1 }),
      file({ id: 2, type: "Training Data" }),
      file({ id: 3, type: "Pruned Model", primary: true }),
    ],
  });
  expect(files.map((f) => f.id)).toEqual([3, 1]);
});

test("file labels read fp, size, format and file size", () => {
  expect(
    fileLabel(file({ fp: "fp16", size: "pruned", format: "SafeTensor", sizeKB: 2_202_010 })),
  ).toBe("fp16 · pruned · SafeTensor · 2.1 GB");
  expect(fileLabel(file({ type: "Pruned Model", sizeKB: 146_000 }))).toBe("Pruned Model · 143 MB");
  expect(fileLabel(file({}))).toBe("x.safetensors");
});

test("model answer carries version files with their metadata", () => {
  const m = parseCivitaiModel({
    id: 1,
    name: "x",
    type: "LORA",
    modelVersions: [
      {
        id: 2,
        name: "v1",
        baseModel: "Flux.1 D",
        files: [{ id: 9, name: "a", type: "Model", primary: true, metadata: { fp: "fp16" } }],
      },
    ],
  });
  expect(m.versions[0]?.baseModel).toBe("Flux.1 D");
  expect(m.versions[0]?.files[0]).toMatchObject({ id: 9, primary: true, fp: "fp16", format: null });
});

test("model tags are lowercased, from strings or { name } objects", () => {
  const m = parseCivitaiModel({
    id: 1,
    name: "x",
    type: "LORA",
    tags: ["Concept", { name: "Style" }, 3, ""],
  });
  expect(m.tags).toEqual(["concept", "style"]);
});

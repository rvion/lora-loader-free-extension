import { expect, test } from "bun:test";

import {
  lmPrefixForCivitaiType,
  parseCivitaiModel,
  parseCivitaiModelUrl,
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
  expect(m).toEqual({ id: 1, name: "x", type: "LORA", versions: [{ id: 2, name: "v1" }] });
  expect(() => parseCivitaiModel({ error: "nope" })).toThrow();
});

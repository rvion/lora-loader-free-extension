import { expect, test } from "bun:test";

import {
  folderOptions,
  locateInRoots,
  rootLabels,
  shortRoot,
  whereInLibrary,
} from "src/shared/paths.ts";

test("a file is located under the longest matching root", () => {
  const roots = ["/m/loras", "/m/loras/extra"];
  expect(locateInRoots("/m/loras/extra/style/a.safetensors", roots)).toEqual({
    root: "/m/loras/extra",
    rel: "style/a.safetensors",
  });
  expect(locateInRoots("C:\\M\\Loras\\x\\b.safetensors", ["c:\\m\\loras"])).toEqual({
    root: "c:\\m\\loras",
    rel: "x/b.safetensors",
  });
  expect(locateInRoots("/elsewhere/c.safetensors", roots)).toEqual({
    root: null,
    rel: "/elsewhere/c.safetensors",
  });
});

test("empty query: root first, then every folder sorted with depth", () => {
  expect(folderOptions(["style/anime", "concept"], "")).toEqual([
    { value: "", depth: 0, isNew: false },
    { value: "concept", depth: 0, isNew: false },
    { value: "style/anime", depth: 1, isNew: false },
  ]);
});

test("a typed path that does not exist is offered as new, at any depth", () => {
  const rows = folderOptions(["style/anime"], "foo/bar/fake1/baz");
  expect(rows[0]).toEqual({ value: "foo/bar/fake1/baz", depth: 0, isNew: true });
  expect(rows).toHaveLength(1);
});

test("an existing folder typed in any case is not new", () => {
  expect(folderOptions(["Style/Anime"], "style/anime")).toEqual([
    { value: "Style/Anime", depth: 1, isNew: false },
  ]);
});

test("where reads as the root folder name, the path inside it, then the file", () => {
  const roots = ["/Users/me/ComfyUI/models/loras"];
  expect(
    whereInLibrary("/Users/me/ComfyUI/models/loras/krea2/styles/a.safetensors", roots),
  ).toEqual({
    rootName: "loras",
    dir: "krea2/styles",
    fileName: "a.safetensors",
  });
  expect(whereInLibrary("/Users/me/ComfyUI/models/loras/b.safetensors", roots)).toEqual({
    rootName: "loras",
    dir: "",
    fileName: "b.safetensors",
  });
});

test("root labels are the shortest tail no other root shares", () => {
  const labels = rootLabels(["/a/models/loras", "/b/extra/loras", "/c/models/checkpoints"]);
  expect(labels.get("/a/models/loras")).toBe("models/loras");
  expect(labels.get("/b/extra/loras")).toBe("extra/loras");
  expect(labels.get("/c/models/checkpoints")).toBe("checkpoints");
  expect(rootLabels(["C:\\ComfyUI\\models\\loras"]).get("C:\\ComfyUI\\models\\loras")).toBe(
    "loras",
  );
});

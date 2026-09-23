import { expect, test } from "bun:test";

import { normalizeSub } from "src/content/CardSt.ts";
import { LmClient, normalizeBaseUrl } from "src/shared/lmClient.ts";

type Call = { url: string; init?: RequestInit };

function fakeLm(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const client = new LmClient("127.0.0.1:8188/", async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    const r = routes[path];
    if (r == null)
      return new Response("Not Found", { status: 404, headers: { "content-type": "text/plain" } });
    return Response.json(r.body, { status: r.status ?? 200 });
  });
  return { client, calls };
}

test("base url accepts a bare host and drops trailing slashes", () => {
  expect(normalizeBaseUrl("127.0.0.1:8188/")).toBe("http://127.0.0.1:8188");
  expect(normalizeBaseUrl(" https://box.tail.ts.net/ ")).toBe("https://box.tail.ts.net");
});

test("base url accepts a bare lan ip and rejects garbage", () => {
  expect(normalizeBaseUrl("192.168.1.20:8188")).toBe("http://192.168.1.20:8188");
  expect(() => normalizeBaseUrl("http://")).toThrow();
  expect(() => normalizeBaseUrl("")).toThrow();
  expect(() => normalizeBaseUrl("ftp://box")).toThrow();
});

test("library status reads exists and model type", async () => {
  const lm = fakeLm({
    "/api/lm/check-model-exists": { body: { success: true, exists: true, modelType: "lora" } },
  });
  expect(await lm.client.libraryStatus(10, 20)).toEqual({ exists: true, modelType: "lora" });
  expect(lm.calls[0]?.url).toBe(
    "http://127.0.0.1:8188/api/lm/check-model-exists?modelId=10&modelVersionId=20",
  );
});

test("folder choices drop the empty root entry", async () => {
  const lm = fakeLm({
    "/api/lm/loras/roots": { body: { success: true, roots: ["/m/loras"] } },
    "/api/lm/loras/folders": { body: { folders: ["", "style", "char/anime"] } },
  });
  expect(await lm.client.folderChoices("loras")).toEqual({
    roots: ["/m/loras"],
    folders: ["style", "char/anime"],
  });
});

test("download posts root, subfolder and our download id", async () => {
  const lm = fakeLm({ "/api/lm/download-model": { body: { success: true } } });
  await lm.client.download({
    downloadId: "d1",
    modelId: 1,
    versionId: 2,
    root: "/m/loras",
    sub: "style",
  });
  expect(JSON.parse(String(lm.calls[0]?.init?.body))).toEqual({
    download_id: "d1",
    model_id: 1,
    model_version_id: 2,
    model_root: "/m/loras",
    relative_path: "style",
    use_default_paths: false,
  });
});

test("download failure carries the server error text", async () => {
  const lm = fakeLm({
    "/api/lm/download-model": { status: 401, body: { success: false, error: "early access" } },
  });
  await expect(
    lm.client.download({ downloadId: "d", modelId: 1, versionId: 2, root: "r", sub: "" }),
  ).rejects.toThrow("early access");
});

test("progress maps running, failed and unknown", async () => {
  const lm = fakeLm({
    "/api/lm/download-progress/a": { body: { success: true, progress: 42 } },
    "/api/lm/download-progress/b": {
      body: { success: true, progress: 10, status: "failed", message: "disk full" },
    },
  });
  expect(await lm.client.progress("a")).toEqual({ kind: "running", percent: 42, stage: null });
  expect(await lm.client.progress("b")).toEqual({ kind: "failed", message: "disk full" });
  expect(await lm.client.progress("zzz")).toEqual({ kind: "unknown" });
});

test("subfolder input is normalized to a relative forward slash path", () => {
  expect(normalizeSub("\\style\\anime")).toBe("style/anime");
  expect(normalizeSub("//a//b")).toBe("a/b");
});

test("restart falls through missing routes and names the one that worked", async () => {
  const lm = fakeLm({ "/manager/reboot": { body: {} } });
  expect(await lm.client.restartComfy()).toBe("POST /manager/reboot");
  expect(lm.calls.map((c) => c.url)).toEqual([
    "http://127.0.0.1:8188/api/manager/reboot",
    "http://127.0.0.1:8188/manager/reboot",
  ]);
});

test("restart refused by security level, or absent, is an error", async () => {
  const refused = fakeLm({ "/api/manager/reboot": { status: 403, body: {} } });
  await expect(refused.client.restartComfy()).rejects.toThrow("security_level");
  await expect(fakeLm({}).client.restartComfy()).rejects.toThrow("ComfyUI-Manager");
});

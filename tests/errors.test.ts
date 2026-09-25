import { expect, test } from "bun:test";

import { ErrorSvc, RELOAD_MESSAGE } from "src/content/ErrorSvc.ts";

const make = () => {
  let t = Date.parse("2026-09-25T14:02:00Z");
  const svc = new ErrorSvc({
    version: "2.21.3",
    url: () => "https://civitai.red/search/models?baseModel=Krea%202",
    now: () => t,
  });
  return { svc, tick: (ms: number) => (t += ms) };
};

// why we think it is actually a bug, and not just meaning spec should change: agent/spec.md "errors" says every failure shows in a panel, and today they only reach the console
test("a failure opens the panel with one row", () => {
  const { svc } = make();
  svc.report("listing", new Error("LoRA Manager did not answer"));
  expect(svc.isOpen).toBe(true);
  expect(svc.rows.map((r) => [r.where, r.message, r.count])).toEqual([
    ["listing", "LoRA Manager did not answer", 1],
  ]);
});

test("a repeat bumps the count instead of adding a row", () => {
  const { svc, tick } = make();
  svc.report("listing", new Error("down"));
  tick(30_000);
  svc.report("listing", new Error("down"));
  svc.report("civitai details", "HTTP 429");
  expect(svc.rows.map((r) => [r.where, r.count])).toEqual([
    ["listing", 2],
    ["civitai details", 1],
  ]);
});

test("closed stays closed for errors already seen, a new one reopens it", () => {
  const { svc } = make();
  svc.report("listing", new Error("down"));
  svc.close();
  svc.report("listing", new Error("down"));
  expect(svc.isOpen).toBe(false);
  svc.report("listing", new Error("another cause"));
  expect(svc.isOpen).toBe(true);
});

test("a dead extension context reads as a reload hint", () => {
  const { svc } = make();
  svc.report("listing", new Error("Extension context invalidated."));
  expect(svc.rows[0]?.message).toBe(RELOAD_MESSAGE);
  expect(svc.rows[0]?.reload).toBe(true);
});

test("the copied block carries version, page, time, where, message, count and stack", () => {
  const { svc } = make();
  const e = new Error("down");
  e.stack = "Error: down\n    at pass (content.js:10:5)";
  svc.report("listing", e);
  svc.report("listing", e);
  const row = svc.rows[0];
  if (row == null) throw new Error("no row");
  expect(svc.copyText([row])).toBe(
    [
      "LoRA Manager Free 2.21.3 errors",
      "page: https://civitai.red/search/models?baseModel=Krea%202",
      "",
      "[2026-09-25T14:02:00.000Z] listing (×2): down",
      "Error: down",
      "    at pass (content.js:10:5)",
    ].join("\n"),
  );
});

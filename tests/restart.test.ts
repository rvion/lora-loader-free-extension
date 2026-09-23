import { expect, test } from "bun:test";

import type { Ping } from "src/shared/lmClient.ts";
import { RestartSt } from "src/shared/RestartSt.ts";

/** fake clock: each sleep advances time, each ping answers from a script */
function rig(p: { pings: boolean[]; restart?: () => Promise<string> }) {
  let t = 0;
  let i = 0;
  let backCalls = 0;
  const st = new RestartSt({
    restart: p.restart ?? (async () => "POST /api/manager/reboot"),
    ping: async (): Promise<Ping> => {
      const up = p.pings[Math.min(i++, p.pings.length - 1)] ?? false;
      return up ? { up: true, version: "1.2.3" } : { up: false };
    },
    onBack: () => backCalls++,
    sleep: async (ms) => void (t += ms),
    now: () => t,
  });
  return { st, backCalls: () => backCalls };
}

test("down then up ends back with the version", async () => {
  const r = rig({ pings: [true, true, false, false, true] });
  await r.st.confirm();
  expect(r.st.phase).toEqual({ kind: "back", seconds: 2, version: "1.2.3" });
  expect(r.backCalls()).toBe(1);
});

test("a server that never goes down is a failed restart", async () => {
  const r = rig({ pings: [true] });
  await r.st.confirm();
  expect(r.st.phase.kind).toBe("failed");
  expect(r.backCalls()).toBe(0);
});

test("a server that never comes back fails after the up window", async () => {
  const r = rig({ pings: [false] });
  await r.st.confirm();
  expect(r.st.phase).toMatchObject({
    kind: "failed",
    message: expect.stringContaining("not back"),
  });
});

test("a refused restart surfaces the reason", async () => {
  const r = rig({
    pings: [true],
    restart: async () => Promise.reject(new Error("security_level")),
  });
  await r.st.confirm();
  expect(r.st.phase).toEqual({ kind: "failed", message: "security_level" });
});

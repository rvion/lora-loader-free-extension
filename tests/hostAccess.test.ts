import { expect, test } from "bun:test";

import { hostPattern } from "src/shared/hostAccess.ts";

test("a grant covers every port of the host, never the path", () => {
  expect(hostPattern("http://192.168.1.20:8188")).toBe("http://192.168.1.20/*");
  expect(hostPattern("https://box.tail.ts.net/comfy")).toBe("https://box.tail.ts.net/*");
});

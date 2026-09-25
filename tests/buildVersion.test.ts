import { expect, test } from "bun:test";

import { nextBuildVersion, withVersion } from "scripts/buildVersion.ts";

// why we think it is actually a bug, and not just meaning spec should change: agent/architecture.md says a build bumps the patch, three numbers, never a fourth
test("each build bumps the patch", () => {
  expect(nextBuildVersion("2.21.1")).toBe("2.21.2");
  expect(nextBuildVersion("2.21.9")).toBe("2.21.10");
});

test("a version that is not three numbers is refused loudly", () => {
  expect(() => nextBuildVersion("1.0.0.3")).toThrow(/three numbers/);
});

test("package.json is rewritten on the version line only, its layout kept", () => {
  const raw = '{\n    "name": "x",\n    "version": "2.21.1",\n    "private": true\n}\n';
  expect(withVersion(raw, "2.21.2")).toBe(
    '{\n    "name": "x",\n    "version": "2.21.2",\n    "private": true\n}\n',
  );
});

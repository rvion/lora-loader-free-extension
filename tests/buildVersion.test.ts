import { expect, test } from "bun:test";

import { nextBuildVersion } from "scripts/buildVersion.ts";

// why we think it is actually a bug, and not just meaning spec should change: agent/architecture.md says every build gets a new version, and two builds that both read 1.0.0 cannot be told apart in chrome://extensions
test("each build increments the previous build number", () => {
  expect(nextBuildVersion("1.0.0", "1.0.0.6")).toBe("1.0.0.7");
});

test("a first build, or a dist from before build numbers, starts at 1", () => {
  expect(nextBuildVersion("1.0.0", null)).toBe("1.0.0.1");
  expect(nextBuildVersion("1.0.0", "1.0.0")).toBe("1.0.0.1");
});

test("a package.json bump restarts the build number", () => {
  expect(nextBuildVersion("1.1.0", "1.0.0.42")).toBe("1.1.0.1");
});

test("chrome's per number limit is refused loudly", () => {
  expect(() => nextBuildVersion("1.0.0", "1.0.0.65535")).toThrow(/65535/);
});

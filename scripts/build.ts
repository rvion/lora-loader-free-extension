// bundles the three entry points into dist/, the folder chrome loads unpacked
import { cp, rm } from "node:fs/promises";

import { nextBuildVersion, withVersion } from "scripts/buildVersion.ts";

const root = new URL("..", import.meta.url).pathname;
const dist = `${root}dist`;

await rm(dist, { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: [
    `${root}src/background/background.ts`,
    `${root}src/content/content.tsx`,
    `${root}src/popup/popup.tsx`,
  ],
  outdir: dist,
  naming: "[name].[ext]",
  target: "browser",
  // content scripts are classic scripts: no top level import/export allowed
  format: "iife",
  minify: false,
  sourcemap: "linked",
  define: { "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production") },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

await cp(`${root}static`, dist, { recursive: true });

// every successful build is a new patch, written back to package.json, the one version source (agent/architecture.md)
const pkgPath = `${root}package.json`;
const raw = await Bun.file(pkgPath).text();
const version = nextBuildVersion((JSON.parse(raw) as { version: string }).version);
await Bun.write(pkgPath, withVersion(raw, version));
const manifest = (await Bun.file(`${dist}/manifest.json`).json()) as Record<string, unknown>;
await Bun.write(`${dist}/manifest.json`, JSON.stringify({ ...manifest, version }, null, 2));
console.log(`built ${version}: ${result.outputs.length} files → ${dist}`);

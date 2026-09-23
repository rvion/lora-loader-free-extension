// bundles the three entry points into dist/, the folder chrome loads unpacked
import { cp, rm } from "node:fs/promises";

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
console.log(`built ${result.outputs.length} files → ${dist}`);

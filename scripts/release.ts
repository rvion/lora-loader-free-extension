// the files a release hands out: the store zip (also the github release asset) and the store promo tile.
// builds without bumping, so the zip carries the committed version
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir } from "node:fs/promises";

import { iconPng } from "scripts/icon.ts";

const root = new URL("..", import.meta.url).pathname;
const out = `${root}.shipkit/chrome-web-store`;

const build = Bun.spawnSync(["bun", "scripts/build.ts", "--release"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (build.exitCode !== 0) process.exit(1);

const { version } = (await Bun.file(`${root}dist/manifest.json`).json()) as { version: string };
await mkdir(out, { recursive: true });
const zipPath = `${out}/civitai-to-lora-manager-${version}.zip`;
await Bun.file(zipPath).delete().catch(() => {});
// sourcemaps stay out: the bundle is not minified, so the code reads as is
const zip = Bun.spawnSync(["zip", "-r", "-X", "-q", zipPath, ".", "-x", "*.map"], { cwd: `${root}dist`, stderr: "inherit" });
if (zip.exitCode !== 0) process.exit(1);

await Bun.write(`${out}/promo-440x280.png`, await promoTile());
console.log(`release ${version}: ${zipPath}\npromo tile: ${out}/promo-440x280.png`);

async function promoTile(): Promise<Buffer> {
  const W = 440;
  const H = 280;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1b1e";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f07a2a";
  ctx.fillRect(0, H - 8, W, 8);
  ctx.drawImage(await loadImage(await iconPng(176)), 18, 46, 176, 176);
  ctx.fillStyle = "#e6e6e6";
  ctx.font = "bold 30px Helvetica, Arial, sans-serif";
  for (const [i, line] of ["Civitai to", "LoRA Manager"].entries()) ctx.fillText(line, 206, 118 + i * 38);
  ctx.fillStyle = "#909296";
  ctx.font = "15px Helvetica, Arial, sans-serif";
  ctx.fillText("unofficial companion", 207, 190);
  return canvas.encode("png");
}

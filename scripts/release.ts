// every file the chrome web store asks, in .shipkit/chrome-web-store/: the zip (also the github release asset), the
// store icon, the two promo tiles. The screenshots need a live LoRA Manager: scripts/shots.ts.
// builds without bumping, so the zip carries the committed version
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdir, readdir, rm } from "node:fs/promises";

import { iconPng } from "scripts/icon.ts";
import { rgbPng } from "scripts/png.ts";

const root = new URL("..", import.meta.url).pathname;
const out = `${root}.shipkit/chrome-web-store`;

const build = Bun.spawnSync(["bun", "scripts/build.ts", "--release"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (build.exitCode !== 0) process.exit(1);

const { version } = (await Bun.file(`${root}dist/manifest.json`).json()) as { version: string };
await mkdir(out, { recursive: true });
for (const f of await readdir(out)) if (f.endsWith(".zip")) await rm(`${out}/${f}`);
const zipPath = `${out}/civitai-to-lora-manager-${version}.zip`;
// sourcemaps stay out: the bundle is not minified, so the code reads as is
const zip = Bun.spawnSync(["zip", "-r", "-X", "-q", zipPath, ".", "-x", "*.map"], { cwd: `${root}dist`, stderr: "inherit" });
if (zip.exitCode !== 0) process.exit(1);

await Bun.write(`${out}/icon-128.png`, await storeIcon());
await Bun.write(`${out}/promo-440x280.png`, await tile(440, 280, false));
await Bun.write(`${out}/marquee-1400x560.png`, await tile(1400, 560, true));
console.log(`release ${version} → ${out}: the zip, icon-128.png, promo-440x280.png, marquee-1400x560.png`);

/** the store's icon rule: 96 px of artwork centered in 128, the 16 px border transparent */
async function storeIcon(): Promise<Buffer> {
  const canvas = createCanvas(128, 128);
  canvas.getContext("2d").drawImage(await loadImage(await iconPng(96)), 16, 16, 96, 96);
  return canvas.encode("png");
}

/** the promo tile at any size, laid out on its height; the marquee adds the summary line */
async function tile(w: number, h: number, wide: boolean): Promise<Buffer> {
  const u = h / 280;
  const canvas = createCanvas(w, h);
  const g = canvas.getContext("2d");
  g.fillStyle = "#1a1b1e";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#f07a2a";
  g.fillRect(0, h - 8 * u, w, 8 * u);
  const icon = 176 * u;
  g.font = `bold ${30 * u}px Helvetica, Arial, sans-serif`;
  const title = wide ? ["Civitai to LoRA Manager"] : ["Civitai to", "LoRA Manager"];
  const text = Math.max(...title.map((l) => g.measureText(l).width));
  const x0 = wide ? (w - icon - 12 * u - text) / 2 : 18 * u;
  g.drawImage(await loadImage(await iconPng(Math.round(icon))), x0, 46 * u, icon, icon);
  const tx = x0 + icon + 12 * u;
  g.fillStyle = "#e6e6e6";
  for (const [i, line] of title.entries()) g.fillText(line, tx, (wide ? 132 : 118) * u + i * 38 * u);
  g.fillStyle = "#909296";
  g.font = `${15 * u}px Helvetica, Arial, sans-serif`;
  if (wide) {
    g.fillText("See what is already in your library.", tx + u, 166 * u);
    g.fillText("Download the rest into the folder you pick.", tx + u, 188 * u);
  } else g.fillText("unofficial companion", tx + u, 190 * u);
  return rgbPng(canvas);
}

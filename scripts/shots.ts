// the store screenshots, 1280x800: the built extension in a real chromium on civitai.com, against the LoRA Manager at
// LM_URL. Headless chromium meets civitai's cloudflare wall, so the window is real and parked off screen.
// usage: bun scripts/shots.ts [scene…]   (LM_URL defaults to the extension's default address)
import { mkdir } from "node:fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chromium, type BrowserContext, type Page } from "playwright-core";

import { rgbPng } from "scripts/png.ts";

const root = new URL("..", import.meta.url).pathname;
const ext = `${root}dist`;
const out = `${root}.shipkit/chrome-web-store/screenshots`;
const lmUrl = process.env.LM_URL ?? "http://127.0.0.1:8188";
const W = 1280;
const H = 800;

/** a model whose versions span several base models, some in the library, some not */
const MODEL = "https://civitai.com/models/1158113";
const LISTING = "https://civitai.com/search/models?sortBy=models_v9&query=pixel%20art";

// civitai's own clutter, never the extension's: the onboarding tour, the event banner, the ad bar
const CLEAN_CSS = `[data-adhesive-ad], .mantine-Tour-root, .mantine-Notifications-root, [role="dialog"][aria-modal="true"] { display: none !important }`;

async function open(ctx: BrowserContext, url: string): Promise<Page> {
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.addStyleTag({ content: CLEAN_CSS });
  await page.getByRole("button", { name: "Skip" }).click({ timeout: 4_000 }).catch(() => {});
  await page.locator("button:right-of(:text(\"Join a team\"))").first().click({ timeout: 2_000 }).catch(() => {});
  await page.waitForSelector(".lmf-chip:not(:has(.lmf-spin))", { timeout: 30_000 });
  await page.waitForTimeout(1_500);
  return page;
}

// the pointer leaves the chips first: a hovered chip opens its tooltip over the shot
async function shoot(page: Page, name: string): Promise<void> {
  await page.mouse.move(W - 40, H / 2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png` });
}

const scenes: Record<string, (ctx: BrowserContext) => Promise<void>> = {
  "1-model-page": async (ctx) => {
    const page = await open(ctx, MODEL);
    await shoot(page, "1-model-page");
  },
  "2-pick-files": async (ctx) => {
    const page = await open(ctx, MODEL);
    await page.locator("[data-lmf-hero] .lmf-chip:has(.lmf-get) .lmf-files").first().click();
    await page.waitForTimeout(800);
    await shoot(page, "2-pick-files");
  },
  "3-listing": async (ctx) => {
    const page = await open(ctx, LISTING);
    await page.getByText("Filters & sorting").locator("xpath=preceding::button[1]").click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(800);
    await shoot(page, "3-listing");
  },
  "4-rules": async (ctx) => {
    const page = await open(ctx, MODEL);
    await page.getByText(/^Rules/).first().click();
    await page.waitForTimeout(800);
    await shoot(page, "4-rules");
  },
  // the toolbar popup, drawn where chrome opens it, over the model page
  "5-popup": async (ctx) => {
    const page = await open(ctx, MODEL);
    await shoot(page, "5-popup");
    const id = new URL(ctx.serviceWorkers()[0]!.url()).host;
    const popup = await ctx.newPage();
    await popup.setViewportSize({ width: 360, height: 600 });
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForTimeout(1_500);
    const shot = await popup.locator("body").screenshot();
    await popup.close();
    const [bg, fg] = await Promise.all([loadImage(`${out}/5-popup.png`), loadImage(shot)]);
    const canvas = createCanvas(W, H);
    const g = canvas.getContext("2d");
    g.drawImage(bg, 0, 0);
    const x = W - fg.width - 16;
    const y = 8;
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = 24;
    g.fillStyle = "#1a1b1e";
    g.fillRect(x, y, fg.width, fg.height);
    g.shadowBlur = 0;
    g.drawImage(fg, x, y);
    g.strokeStyle = "#373a40";
    g.strokeRect(x - 0.5, y - 0.5, fg.width + 1, fg.height + 1);
    await Bun.write(`${out}/5-popup.png`, rgbPng(canvas));
  },
};

const picked = process.argv.slice(2);
const run = picked.length > 0 ? picked : Object.keys(scenes);
for (const name of run) if (!(name in scenes)) throw new Error(`no scene « ${name} »: ${Object.keys(scenes).join(", ")}`);

const lm = await fetch(`${lmUrl}/api/lm/loras/roots`, { signal: AbortSignal.timeout(3_000) }).catch(() => null);
if (lm?.ok !== true) throw new Error(`LoRA Manager does not answer at ${lmUrl}: start it, or set LM_URL`);
await mkdir(out, { recursive: true });
const ctx = await chromium.launchPersistentContext(`${root}.shipkit/cache/shots-profile`, {
  channel: "chromium",
  headless: false,
  viewport: { width: W, height: H },
  args: ["--window-position=-3000,0", `--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
try {
  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
  await sw.evaluate((lmUrl) => chrome.storage.sync.set({ settings: { lmUrl } }), lmUrl);
  for (const name of run) {
    const t0 = Date.now();
    await scenes[name]!(ctx);
    console.log(`${name}: ${Date.now() - t0} ms`);
  }
} finally {
  await ctx.close();
}

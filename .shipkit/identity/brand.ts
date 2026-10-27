// identity source for `shipkit assets identity`: the mark is icon.svg, the same
// file the extension's manifest icons are rendered from (scripts/icon.ts)
import type { SKRSContext2D } from "@napi-rs/canvas";
import { canvas, type Brand } from "rvlib-shipkit";

import { iconPng } from "scripts/icon.ts";
import { loadImage } from "@napi-rs/canvas";

const brand: Brand = {
  name: "Civitai to LoRA Manager",
  tagline: "See what is already in your library. Download the rest in one click.",
  // the popup's own colours, and the arrow's orange
  palette: { bg: "#1a1b1e", accent: "#f07a2a", ink: "#e6e6e6" },
  mark: canvas(async (raw) => {
    const ctx = raw as SKRSContext2D;
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(await loadImage(await iconPng(width)), 0, 0, width, height);
  }),
};

export default brand;

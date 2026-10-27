// the one icon source: .shipkit/identity/icon.svg, rendered for the manifest and the brand kit
import { createCanvas, loadImage } from "@napi-rs/canvas";

export const ICON_SVG = new URL("../.shipkit/identity/icon.svg", import.meta.url).pathname;
export const MANIFEST_ICON_SIZES = [16, 32, 48, 128] as const;

/** canvas rasterizes an svg at its own width and height, so they are set to the target size first */
export async function iconPng(size: number): Promise<Buffer> {
  const svg = (await Bun.file(ICON_SVG).text()).replace(
    'width="128" height="128"',
    `width="${size}" height="${size}"`,
  );
  const canvas = createCanvas(size, size);
  canvas.getContext("2d").drawImage(await loadImage(Buffer.from(svg)), 0, 0, size, size);
  return canvas.encode("png");
}

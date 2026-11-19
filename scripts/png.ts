// a 24-bit png (color type 2, no alpha) out of a canvas: the chrome web store refuses an alpha channel on its tiles
// and screenshots, and canvas.encode("png") always writes one
import type { Canvas } from "@napi-rs/canvas";
import { deflateSync } from "node:zlib";

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(Bun.hash.crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

/** the canvas flattened on its own pixels: a transparent pixel becomes black, so draw a background first */
export function rgbPng(canvas: Canvas): Buffer {
  const { width: w, height: h } = canvas;
  const rgba = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[row + 1 + x * 3] = rgba[i]!;
      raw[row + 2 + x * 3] = rgba[i + 1]!;
      raw[row + 3 + x * 3] = rgba[i + 2]!;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/**
 * Shared A5 portrait master conversion — used by every image pipeline that
 * produces print-ready output (covers, story illustrations, coloring pages).
 *
 * Single source of truth.  Never duplicate this logic.
 */
import sharp from "sharp";

// 300 DPI A5 portrait
//   148 mm × (300 / 25.4) = 1748.03 → 1748 px
//   210 mm × (300 / 25.4) = 2480.31 → 2480 px
export const A5_W   = 1748;
export const A5_H   = 2480;
export const A5_DPI = 300;

/**
 * Mean pixel brightness across all three RGB channels (0–255 scale).
 * Values above 220 indicate a predominantly white / near-white image —
 * characteristic of coloring-page line art and character reference sheets.
 */
async function meanBrightness(buf: Buffer): Promise<number> {
  const { channels } = await sharp(buf).stats();
  return (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
}

/**
 * Convert any source image into a print-ready A5 portrait master at 300 DPI
 * (1748 × 2480 px) with zero destructive cropping and zero distortion.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  RULES — never violate these                                    │
 * │  • Never crop, clip, or discard any part of the artwork         │
 * │  • Never stretch or squash the image (preserve aspect ratio)    │
 * │  • Never distort characters, faces, hands, feet, or line art    │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Extension strategy is chosen automatically from background brightness:
 *
 *  ① WHITE / near-white  (brightness > 220)
 *    → Coloring pages, character sheets, simple flat backgrounds.
 *    → `contain` inside A5 canvas; remaining gaps filled with solid white.
 *    → For a 1024²  source: artwork 1748 × 1748 px, white bars 366 px top+bottom.
 *
 *  ② COMPLEX scene  (brightness ≤ 220)
 *    → Colour illustrations, covers with rich backgrounds.
 *    → Scale artwork to fill the full 1748 px width (maintain aspect ratio).
 *    → Mirror-extend top and bottom edges to reach 2480 px — libvips reflects
 *      edge pixels outward so sky continues as sky and ground as ground,
 *      without any AI call and without touching the central artwork.
 *    → For a 1024²  source: artwork 1748 × 1748 px, mirrored 366 px top+bottom.
 *
 *  ③ Safety fallback (artwork taller than A5 at full width)
 *    → `contain` with white fill — artwork is never cropped.
 */
export async function toA5Master(inputBuf: Buffer): Promise<Buffer> {
  // ── 1. Flatten alpha channel → white ─────────────────────────────────────
  const flat = await sharp(inputBuf)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  // ── 2. Detect background type ─────────────────────────────────────────────
  const brightness = await meanBrightness(flat);
  const isLightBg  = brightness > 220;

  // ── 3a. Light/white background — contain + white fill ────────────────────
  if (isLightBg) {
    return sharp(flat)
      .resize(A5_W, A5_H, {
        fit:        "contain",
        position:   "centre",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .withMetadata({ density: A5_DPI })
      .png({ compressionLevel: 8 })
      .toBuffer();
  }

  // ── 3b. Complex scene background — scale to width, mirror-extend top/bottom
  const { width: srcW, height: srcH } = await sharp(flat).metadata();
  const scaledH = Math.round(A5_W * (srcH ?? A5_W) / (srcW ?? A5_W));

  // Safety: if artwork fills more than A5 height at full width, fall back to contain
  if (scaledH >= A5_H) {
    return sharp(flat)
      .resize(A5_W, A5_H, {
        fit:        "contain",
        position:   "centre",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .withMetadata({ density: A5_DPI })
      .png({ compressionLevel: 8 })
      .toBuffer();
  }

  const topPad    = Math.floor((A5_H - scaledH) / 2);
  const bottomPad = A5_H - scaledH - topPad;

  // Scale artwork to exactly A5_W × scaledH (no crop, no distortion)
  const scaled = await sharp(flat)
    .resize(A5_W, scaledH, { fit: "fill" })
    .png()
    .toBuffer();

  // Mirror-extend top and bottom to reach A5_H
  return sharp(scaled)
    .extend({
      top:        topPad,
      bottom:     bottomPad,
      left:       0,
      right:      0,
      extendWith: "mirror",
    })
    .withMetadata({ density: A5_DPI })
    .png({ compressionLevel: 8 })
    .toBuffer();
}

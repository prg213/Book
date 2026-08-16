/**
 * PDF generation routes — produce print-ready A5 PDFs from stored story images.
 *
 * Pipeline:
 *   AI image → A5 Master (1748 × 2480 px, 300 DPI) → embed in A5 PDF page → download
 *
 * Images stored in GCS are already A5@300DPI (1748 × 2480).  They are embedded
 * at the full A5 page size in the PDF without any further scaling or cropping.
 * Legacy square images (older stories) are placed with `contain` logic so no
 * artwork is ever cropped.
 *
 * Endpoints:
 *   GET /api/stories/:id/pdf           — colour story (illustrations + text pages)
 *   GET /api/stories/:id/pdf/coloring  — coloring book (line-art illustrations only)
 */

import { Router } from "express";
import { createHash } from "crypto";
import { PDFDocument, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { eq, asc } from "drizzle-orm";
import { db, storiesTable, storyPagesTable } from "@workspace/db";
import { fetchImageBuffer } from "../lib/imageStorage";
import { generateColouringPage } from "../lib/grok";
import { toA5Master } from "../lib/a5";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router = Router();

// ── A5 page dimensions in PDF points ─────────────────────────────────────────
// 1 point = 1/72 inch · 1 inch = 25.4 mm
// 148 mm × (72 / 25.4) = 419.527... pt
// 210 mm × (72 / 25.4) = 595.275... pt
const A5_W = 148 * (72 / 25.4); // ≈ 419.53 pt
const A5_H = 210 * (72 / 25.4); // ≈ 595.28 pt

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Read a GCS file stream into a Buffer. */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch or generate (and GCS-cache) a coloring page for the given source image URL.
 * Mirrors the caching logic in routes/colouring.ts so they share the same cache.
 */
async function getOrMakeColouringPage(imageUrl: string): Promise<Buffer> {
  const hash      = createHash("sha256").update(imageUrl).digest("hex").slice(0, 16);
  const objectPath = `story-images/colouring/${hash}.png`;
  const bucketId  = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

  // Check cache
  if (bucketId) {
    try {
      const file = objectStorageClient.bucket(bucketId).file(objectPath);
      const [exists] = await file.exists();
      if (exists) {
        return streamToBuffer(file.createReadStream());
      }
    } catch (err) {
      logger.warn({ err }, "pdf/colouring: cache check failed — regenerating");
    }
  }

  // Generate
  logger.info({ imageUrl }, "pdf/colouring: generating coloring page");
  const sourceBuf    = await fetchImageBuffer(imageUrl);
  const colouringBuf = await generateColouringPage(sourceBuf);
  const a5Buf        = await toA5Master(colouringBuf);

  // Save to cache
  if (bucketId) {
    try {
      await objectStorageClient
        .bucket(bucketId)
        .file(objectPath)
        .save(a5Buf, { contentType: "image/png", resumable: false });
    } catch (err) {
      logger.warn({ err }, "pdf/colouring: cache write failed");
    }
  }

  return a5Buf;
}

/**
 * Embed an image on an A5 PDF page with CONTAIN logic — the artwork is never
 * cropped and never distorted regardless of the source aspect ratio.
 *
 * • A5@300DPI images (1748 × 2480): fill the page exactly — pixel-perfect.
 * • Legacy square images (1024 × 1024): fill full width, centred vertically
 *   with white padding top/bottom.
 * • Any other ratio: contained within the page with white padding.
 */
async function drawImageOnPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  imgBuf: Buffer,
): Promise<void> {
  // Detect format by magic bytes
  const isJpeg = imgBuf[0] === 0xff && imgBuf[1] === 0xd8;
  const img    = isJpeg ? await pdfDoc.embedJpg(imgBuf) : await pdfDoc.embedPng(imgBuf);

  const { width: imgW, height: imgH } = img;
  const pageW = A5_W;
  const pageH = A5_H;
  const imgRatio  = imgW / imgH;
  const pageRatio = pageW / pageH;

  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (Math.abs(imgRatio - pageRatio) < 0.01) {
    // Already A5 ratio — fill the page exactly (pixel-perfect 300 DPI)
    drawW = pageW; drawH = pageH; drawX = 0; drawY = 0;
  } else if (imgRatio > pageRatio) {
    // Image wider relative to page → constrain by width
    drawW  = pageW;
    drawH  = pageW / imgRatio;
    drawX  = 0;
    drawY  = (pageH - drawH) / 2;
  } else {
    // Image taller relative to page → constrain by height
    drawH  = pageH;
    drawW  = pageH * imgRatio;
    drawX  = (pageW - drawW) / 2;
    drawY  = 0;
  }

  // White background for any padding areas (also ensures no transparency bleed)
  page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(1, 1, 1) });
  page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
}

/** Simple word-wrap for pdf-lib (which has no built-in wrapping). */
function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  fontSize: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { lines.push(""); continue; }
    let current = "";
    for (const word of para.split(" ")) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/** Draw a title band at the bottom of the cover page. */
async function drawCoverTitleBand(
  page: PDFPage,
  title: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
): Promise<void> {
  const bandH    = 56;          // pt  ≈ 20 mm
  const fontSize = 18;
  const margin   = 20;
  const maxW     = A5_W - margin * 2;

  // White band
  page.drawRectangle({ x: 0, y: 0, width: A5_W, height: bandH, color: rgb(1, 1, 1), opacity: 0.93 });
  // Top border
  page.drawLine({
    start: { x: 0, y: bandH }, end: { x: A5_W, y: bandH },
    thickness: 0.5, color: rgb(0, 0, 0), opacity: 0.12,
  });

  const lines  = wrapText(title, font, fontSize, maxW);
  const lineH  = fontSize * 1.28;
  const totalH = lines.length * lineH;
  let ty = (bandH + totalH) / 2 - lineH * 0.18;

  for (const line of lines) {
    const lw = font.widthOfTextAtSize(line, fontSize);
    page.drawText(line, {
      x: (A5_W - lw) / 2, y: ty,
      size: fontSize, font,
      color: rgb(0.067, 0.067, 0.067),
    });
    ty -= lineH;
  }
}

// ── GET /api/stories/:id/pdf ──────────────────────────────────────────────────
// Full-colour story PDF: cover · illustration pages · text pages.
router.get("/stories/:id/pdf", async (req, res) => {
  const { id } = req.params;
  logger.info({ id }, "pdf: generating colour PDF");

  try {
    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id));
    if (!story) return res.status(404).json({ error: "Story not found" });

    const pages = await db
      .select().from(storyPagesTable)
      .where(eq(storyPagesTable.storyId, id))
      .orderBy(asc(storyPagesTable.num));

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(story.title ?? "My Story");
    pdfDoc.setCreator("MyStoryBook");
    pdfDoc.setProducer("pdf-lib + MyStoryBook");

    const timesRoman     = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // ── Cover page ──────────────────────────────────────────────────────────
    if (story.coverImageUrl) {
      const coverBuf  = await fetchImageBuffer(story.coverImageUrl);
      const coverPage = pdfDoc.addPage([A5_W, A5_H]);
      await drawImageOnPage(pdfDoc, coverPage, coverBuf);
      await drawCoverTitleBand(coverPage, story.title ?? "", timesRomanBold);
    }

    // ── Story pages ─────────────────────────────────────────────────────────
    for (const p of pages) {

      // Illustration page
      if (p.imageUrl) {
        const imgBuf  = await fetchImageBuffer(p.imageUrl);
        const imgPage = pdfDoc.addPage([A5_W, A5_H]);
        await drawImageOnPage(pdfDoc, imgPage, imgBuf);
        // Small page number in bottom-left
        imgPage.drawText(String(p.num), {
          x: 16, y: 14, size: 8, font: timesRoman,
          color: rgb(0.55, 0.43, 0.2), opacity: 0.65,
        });
      }

      // Text page
      if (p.text) {
        const textPage = pdfDoc.addPage([A5_W, A5_H]);
        textPage.drawRectangle({ x: 0, y: 0, width: A5_W, height: A5_H, color: rgb(1, 1, 1) });

        // Header — story title (small, grey, uppercase)
        const headerY    = A5_H - 36;
        const headerTxt  = (story.title ?? "").toUpperCase();
        const headerSize = 6.5;
        const headerW    = timesRoman.widthOfTextAtSize(headerTxt, headerSize);
        textPage.drawText(headerTxt, {
          x: (A5_W - headerW) / 2, y: headerY,
          size: headerSize, font: timesRoman,
          color: rgb(0, 0, 0), opacity: 0.35,
          characterSpacing: 1.5,
        });
        textPage.drawLine({
          start: { x: 28, y: headerY - 7 }, end: { x: A5_W - 28, y: headerY - 7 },
          thickness: 0.5, color: rgb(0, 0, 0), opacity: 0.15,
        });

        // Body text — large, centred, wrapped
        const bodySize   = 18;
        const lineH      = bodySize * 1.9;
        const sideMargin = 40;
        const textW      = A5_W - sideMargin * 2;
        const bodyLines  = wrapText(p.text, timesRoman, bodySize, textW);
        const topBound   = headerY - 16;
        const botBound   = 38;
        const availH     = topBound - botBound;
        const totalH     = bodyLines.length * lineH;
        let ly = topBound - (availH - totalH) / 2 - lineH * 0.12;

        for (const line of bodyLines) {
          if (ly < botBound) break;
          const lw = timesRoman.widthOfTextAtSize(line, bodySize);
          textPage.drawText(line, {
            x: (A5_W - lw) / 2, y: ly,
            size: bodySize, font: timesRoman,
            color: rgb(0.227, 0.122, 0.024), // book-brown #3a1f06
          });
          ly -= lineH;
        }

        // Footer — page number
        const footNum = String((p.num ?? 0) + 1);
        const footW   = timesRoman.widthOfTextAtSize(footNum, 8);
        textPage.drawText(footNum, {
          x: (A5_W - footW) / 2, y: 14,
          size: 8, font: timesRoman,
          color: rgb(0, 0, 0), opacity: 0.3,
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const safeName = (story.title ?? "story").replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_");
    const filename = `${safeName}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBytes.byteLength));
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(pdfBytes));

  } catch (err) {
    logger.error({ err }, "pdf: failed to generate colour PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ── GET /api/stories/:id/pdf/coloring ────────────────────────────────────────
// Coloring book PDF: line-art versions of cover + all illustrations.
// Fetches cached coloring pages from GCS or generates them on demand.
router.get("/stories/:id/pdf/coloring", async (req, res) => {
  const { id } = req.params;
  logger.info({ id }, "pdf: generating coloring PDF");

  try {
    const [story] = await db.select().from(storiesTable).where(eq(storiesTable.id, id));
    if (!story) return res.status(404).json({ error: "Story not found" });

    const pages = await db
      .select().from(storyPagesTable)
      .where(eq(storyPagesTable.storyId, id))
      .orderBy(asc(storyPagesTable.num));

    const imageUrls: string[] = [
      ...(story.coverImageUrl ? [story.coverImageUrl] : []),
      ...pages.filter(p => p.imageUrl).map(p => p.imageUrl as string),
    ];

    if (imageUrls.length === 0) {
      return res.status(400).json({ error: "No images available yet — story is still generating" });
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.setTitle(`${story.title ?? "My Story"} — Colouring Book`);
    pdfDoc.setCreator("MyStoryBook");
    pdfDoc.setProducer("pdf-lib + MyStoryBook");

    const timesRomanBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    let isFirstPage = true;

    for (const url of imageUrls) {
      const colouringBuf = await getOrMakeColouringPage(url);
      const page         = pdfDoc.addPage([A5_W, A5_H]);
      await drawImageOnPage(pdfDoc, page, colouringBuf);

      // Title band on the cover page only
      if (isFirstPage && story.coverImageUrl) {
        await drawCoverTitleBand(page, story.title ?? "", timesRomanBold);
      }
      isFirstPage = false;
    }

    const pdfBytes = await pdfDoc.save();
    const safeName = (story.title ?? "story").replace(/[^a-z0-9]/gi, "_").replace(/_+/g, "_");
    const filename = `${safeName}_colouring.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(pdfBytes.byteLength));
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(pdfBytes));

  } catch (err) {
    logger.error({ err }, "pdf: failed to generate coloring PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;

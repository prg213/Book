/**
 * A5 PDF download for MyStoryBook.
 *
 * Each printable element gets its own A5 page:
 *   1. Cover illustration  — full-bleed image
 *   2. Title page          — title + optional subtitle, centred
 *   3. Per story page:
 *        a. Illustration page — full-bleed image
 *        b. Story text page   — text centred on plain page
 *   4. "The End" page
 */

import jsPDF from 'jspdf';

const A5_W = 148;  // mm
const A5_H = 210;  // mm
const MARGIN = 8;  // mm — used on text-only pages

/** Convert an image URL to a base64 data-URL. */
async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror   = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadStoryPdf(story: {
  id: string;
  title: string;
  style?: string | null;
  coverImageUrl?: string | null;
}, pages: Array<{
  pageNumber: number;
  text?: string | null;
  imageUrl?: string | null;
}>): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });

  const isColouring = story.style === 'colouring';
  const bgColour    = isColouring ? '#ffffff' : '#fdf6e3';
  const textColour: [number, number, number] = isColouring ? [20, 10, 0] : [58, 31, 6];
  const accentColour = isColouring ? '#444444' : '#c9a96e';

  // ── Helpers ──────────────────────────────────────────────────────────────

  function fillBg() {
    pdf.setFillColor(bgColour);
    pdf.rect(0, 0, A5_W, A5_H, 'F');
  }

  /** Thin double-rule border on text pages. */
  function drawBorder() {
    pdf.setDrawColor(accentColour);
    pdf.setLineWidth(0.5);
    pdf.rect(4, 4, A5_W - 8, A5_H - 8, 'S');
    pdf.setLineWidth(0.2);
    pdf.rect(5.5, 5.5, A5_W - 11, A5_H - 11, 'S');
  }

  /** Full-bleed image page — image fills the entire A5 canvas. */
  async function addImagePage(imageUrl: string | null | undefined, isFirst = false) {
    if (!isFirst) pdf.addPage('a5', 'portrait');

    // White/cream background behind image in case it has transparency
    pdf.setFillColor('#ffffff');
    pdf.rect(0, 0, A5_W, A5_H, 'F');

    if (imageUrl) {
      const b64 = await urlToBase64(imageUrl);
      if (b64) {
        try {
          // Fit the image to fill the full page maintaining aspect ratio
          pdf.addImage(b64, 'PNG', 0, 0, A5_W, A5_H, undefined, 'FAST');
        } catch { /* skip broken image */ }
      }
    }
  }

  /** Text-only page with decorative border. */
  function addTextPage(lines: string[], fontSize: number, fontStyle: string, isFirst = false) {
    if (!isFirst) pdf.addPage('a5', 'portrait');
    fillBg();
    drawBorder();

    pdf.setFont('times', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...textColour);

    // Vertically centre the text block
    const lineH    = fontSize * 0.38; // mm per line (jsPDF internal scale)
    const blockH   = lines.length * lineH * 1.4;
    const startY   = (A5_H - blockH) / 2 + lineH;

    pdf.text(lines, A5_W / 2, startY, { align: 'center', lineHeightFactor: 1.5 });
  }

  /** Small page-number label bottom-right, on text pages only. */
  function addPageNumber(n: number) {
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(160, 140, 110);
    pdf.text(String(n), A5_W - MARGIN - 1, A5_H - MARGIN + 1, { align: 'right' });
  }

  // ── 1. COVER ILLUSTRATION ─────────────────────────────────────────────────
  await addImagePage(story.coverImageUrl, /* isFirst */ true);

  // ── 2. TITLE PAGE ─────────────────────────────────────────────────────────
  pdf.addPage('a5', 'portrait');
  fillBg();
  drawBorder();

  const titleFontSize = story.title.length > 30 ? 16 : story.title.length > 20 ? 20 : 24;
  const titleLines    = pdf.setFont('times', 'bold').setFontSize(titleFontSize)
                           .splitTextToSize(story.title, A5_W - MARGIN * 2 - 8);

  const titleBlockH   = titleLines.length * (titleFontSize * 0.38) * 1.5;
  const titleY        = isColouring
    ? A5_H / 2 - titleBlockH / 2 - 6
    : A5_H / 2 - titleBlockH / 2 - 6;

  pdf.setTextColor(...textColour);
  pdf.text(titleLines, A5_W / 2, titleY, { align: 'center', lineHeightFactor: 1.5 });

  if (isColouring) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text('Colouring Book Edition', A5_W / 2, titleY + titleBlockH + 10, { align: 'center' });
  }

  // Decorative rule under title
  pdf.setDrawColor(accentColour);
  pdf.setLineWidth(0.4);
  const ruleY = titleY + titleBlockH + (isColouring ? 18 : 6);
  pdf.line(A5_W / 2 - 24, ruleY, A5_W / 2 + 24, ruleY);

  // ── 3. STORY PAGES — illustration then text, each on its own A5 ───────────
  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (const page of sortedPages) {
    // 3a. Illustration page
    await addImagePage(page.imageUrl);

    // 3b. Text page
    const rawText = (page.text ?? '').trim();
    if (rawText) {
      pdf.addPage('a5', 'portrait');
      fillBg();
      drawBorder();

      const storyFontSize = 13;
      pdf.setFont('times', 'normal').setFontSize(storyFontSize);
      const storyLines = pdf.splitTextToSize(rawText, A5_W - MARGIN * 2 - 10);

      const lineH   = storyFontSize * 0.38;
      const blockH  = storyLines.length * lineH * 1.5;
      const startY  = (A5_H - blockH) / 2 + lineH;

      pdf.setTextColor(...textColour);
      pdf.text(storyLines, A5_W / 2, startY, { align: 'center', lineHeightFactor: 1.5 });

      addPageNumber(page.pageNumber);
    }
  }

  // ── 4. THE END ────────────────────────────────────────────────────────────
  pdf.addPage('a5', 'portrait');
  fillBg();
  drawBorder();

  pdf.setFont('times', 'bolditalic');
  pdf.setFontSize(32);
  pdf.setTextColor(...textColour);
  pdf.text('The End', A5_W / 2, A5_H / 2 - 4, { align: 'center' });

  pdf.setFont('times', 'italic');
  pdf.setFontSize(10);
  pdf.setTextColor(160, 140, 110);
  pdf.text(story.title, A5_W / 2, A5_H / 2 + 12, { align: 'center' });

  // ── Save ─────────────────────────────────────────────────────────────────
  const safeName = story.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'story';
  const suffix   = isColouring ? ' - Colouring Book' : '';
  pdf.save(`${safeName}${suffix}.pdf`);
}

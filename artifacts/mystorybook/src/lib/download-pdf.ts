/**
 * A5 PDF download for MyStoryBook.
 *
 * Layout (portrait, 148 × 210 mm):
 *   Cover page  — full-width illustration + title below
 *   Story pages — illustration (top ~53%) + story text (bottom ~47%)
 *
 * For "colouring" style stories the images are already black-and-white line
 * art from the AI, so they are embedded as-is.
 * For "colour" style stories the images are embedded in full colour so the
 * PDF is still a beautiful keepsake; users who want colouring pages should
 * create a Colouring Book story from the start.
 */

import jsPDF from 'jspdf';

const A5_W = 148;   // mm
const A5_H = 210;   // mm
const MARGIN = 10;  // mm

/** Convert an image URL to a base64 data-URL via an off-screen canvas. */
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

/** Wrap text to fit within `maxWidth` mm at the given font size (jsPDF px≈mm). */
function wrapText(pdf: jsPDF, text: string, maxWidth: number): string[] {
  return pdf.splitTextToSize(text, maxWidth);
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  const bgColour = isColouring ? '#ffffff' : '#fdf6e3';
  const textColour: [number, number, number] = isColouring ? [20, 10, 0] : [58, 31, 6];

  function fillBackground(colour: string) {
    pdf.setFillColor(colour);
    pdf.rect(0, 0, A5_W, A5_H, 'F');
  }

  function drawPageFrame() {
    // Outer border
    pdf.setDrawColor(isColouring ? '#444444' : '#c9a96e');
    pdf.setLineWidth(0.4);
    pdf.rect(3, 3, A5_W - 6, A5_H - 6, 'S');
    // Inner decorative border
    pdf.setLineWidth(0.2);
    pdf.rect(4.5, 4.5, A5_W - 9, A5_H - 9, 'S');
  }

  // ── COVER PAGE ────────────────────────────────────────────────────────────
  fillBackground(bgColour);
  drawPageFrame();

  // Illustration — square, full inner width
  const coverImgSize = A5_W - MARGIN * 2; // 128mm
  const coverImgY    = MARGIN + 4;

  if (story.coverImageUrl) {
    const b64 = await urlToBase64(story.coverImageUrl);
    if (b64) {
      try {
        pdf.addImage(b64, 'PNG', MARGIN, coverImgY, coverImgSize, coverImgSize);
      } catch { /* skip broken image */ }
    }
  }

  // Title below image
  const titleY = coverImgY + coverImgSize + 8;

  pdf.setFont('times', 'bold');
  pdf.setTextColor(...textColour);

  // Scale title font size down if the title is long
  const baseFontSize = story.title.length > 30 ? 14 : story.title.length > 20 ? 16 : 20;
  pdf.setFontSize(baseFontSize);
  const titleLines = wrapText(pdf, story.title, A5_W - MARGIN * 2 - 4);
  pdf.text(titleLines, A5_W / 2, titleY, { align: 'center' });

  // Subtitle / mode label
  if (isColouring) {
    const subtitleY = titleY + titleLines.length * (baseFontSize * 0.38) + 5;
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Colouring Book Edition', A5_W / 2, subtitleY, { align: 'center' });
  }

  // ── STORY PAGES ───────────────────────────────────────────────────────────
  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Illustration zone: top portion of page
  const illus_H = 112; // mm  (~53% of A5 height)
  const illus_W = A5_W - MARGIN * 2;
  const illus_X = MARGIN;
  const illus_Y = MARGIN + 4;

  // Text zone: below illustration
  const text_Y_start = illus_Y + illus_H + 5;
  const text_H       = A5_H - text_Y_start - MARGIN - 4; // remaining space
  const text_W       = A5_W - MARGIN * 2 - 4;

  for (const page of sortedPages) {
    pdf.addPage('a5', 'portrait');
    fillBackground(bgColour);
    drawPageFrame();

    // Illustration
    if (page.imageUrl) {
      const b64 = await urlToBase64(page.imageUrl);
      if (b64) {
        try {
          pdf.addImage(b64, 'PNG', illus_X, illus_Y, illus_W, illus_H);
        } catch { /* skip */ }
      }
    }

    // Decorative separator line between illustration and text
    pdf.setDrawColor(isColouring ? '#888888' : '#c9a96e');
    pdf.setLineWidth(0.3);
    const sepY = illus_Y + illus_H + 2;
    pdf.line(MARGIN + 4, sepY, A5_W - MARGIN - 4, sepY);

    // Story text
    if (page.text) {
      pdf.setFont('times', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(...textColour);
      const lines = wrapText(pdf, page.text, text_W);

      // Centre the text block vertically in the remaining space
      const lineH     = 5.5; // mm per line at 11pt
      const blockH    = lines.length * lineH;
      const textStartY = text_Y_start + Math.max(0, (text_H - blockH) / 2);
      pdf.text(lines, A5_W / 2, textStartY, { align: 'center', lineHeightFactor: 1.4 });
    }

    // Page number — bottom right
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 130, 100);
    pdf.text(String(page.pageNumber), A5_W - MARGIN - 2, A5_H - MARGIN, { align: 'right' });
  }

  // ── THE END page ──────────────────────────────────────────────────────────
  pdf.addPage('a5', 'portrait');
  fillBackground(bgColour);
  drawPageFrame();
  pdf.setFont('times', 'bolditalic');
  pdf.setFontSize(28);
  pdf.setTextColor(...textColour);
  pdf.text('The End', A5_W / 2, A5_H / 2, { align: 'center' });
  pdf.setFont('times', 'italic');
  pdf.setFontSize(10);
  pdf.setTextColor(150, 130, 100);
  pdf.text(story.title, A5_W / 2, A5_H / 2 + 12, { align: 'center' });

  // ── Save ─────────────────────────────────────────────────────────────────
  const safeName = story.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'story';
  const suffix   = isColouring ? ' - Colouring Book' : '';
  pdf.save(`${safeName}${suffix}.pdf`);
}

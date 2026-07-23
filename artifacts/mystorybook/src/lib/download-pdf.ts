/**
 * A5 PDF download for MyStoryBook — Colouring Book Edition.
 *
 * Every element gets its own full A5 page (portrait, 148 × 210 mm):
 *   1. Cover illustration  — full-bleed
 *   2. Title page          — centred title
 *   3. Per story page:
 *        a. Illustration   — full-bleed (ready to colour in)
 *        b. Story text     — centred on plain page
 *   4. "The End" page
 */

import jsPDF from 'jspdf';

const A5_W = 148;
const A5_H = 210;
const MARGIN = 8;

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

  // Always colouring-book style: white background, black ink
  const BG    = '#ffffff';
  const INK:  [number, number, number] = [20, 10, 0];
  const RULE  = '#333333';

  function fillBg() {
    pdf.setFillColor(BG);
    pdf.rect(0, 0, A5_W, A5_H, 'F');
  }

  function drawBorder() {
    pdf.setDrawColor(RULE);
    pdf.setLineWidth(0.6);
    pdf.rect(4, 4, A5_W - 8, A5_H - 8, 'S');
    pdf.setLineWidth(0.2);
    pdf.rect(5.8, 5.8, A5_W - 11.6, A5_H - 11.6, 'S');
  }

  async function addImagePage(imageUrl: string | null | undefined, isFirst = false) {
    if (!isFirst) pdf.addPage('a5', 'portrait');
    pdf.setFillColor('#ffffff');
    pdf.rect(0, 0, A5_W, A5_H, 'F');
    if (imageUrl) {
      const b64 = await urlToBase64(imageUrl);
      if (b64) {
        try { pdf.addImage(b64, 'PNG', 0, 0, A5_W, A5_H, undefined, 'FAST'); }
        catch { /* skip */ }
      }
    }
  }

  // ── 1. Cover illustration ────────────────────────────────────────────────
  await addImagePage(story.coverImageUrl, true);

  // ── 2. Title page ────────────────────────────────────────────────────────
  pdf.addPage('a5', 'portrait');
  fillBg();
  drawBorder();

  const titleFontSize = story.title.length > 30 ? 16 : story.title.length > 20 ? 20 : 24;
  const titleLines = pdf
    .setFont('times', 'bold')
    .setFontSize(titleFontSize)
    .splitTextToSize(story.title, A5_W - MARGIN * 2 - 8);

  const titleBlockH = titleLines.length * (titleFontSize * 0.38) * 1.5;
  const titleY      = A5_H / 2 - titleBlockH / 2;

  pdf.setTextColor(...INK);
  pdf.text(titleLines, A5_W / 2, titleY, { align: 'center', lineHeightFactor: 1.5 });

  // Subtitle
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(10);
  pdf.setTextColor(110, 110, 110);
  pdf.text('Colouring Book Edition', A5_W / 2, titleY + titleBlockH + 10, { align: 'center' });

  // Rule
  pdf.setDrawColor(RULE);
  pdf.setLineWidth(0.4);
  const ruleY = titleY + titleBlockH + 18;
  pdf.line(A5_W / 2 - 24, ruleY, A5_W / 2 + 24, ruleY);

  // ── 3. Story pages ────────────────────────────────────────────────────────
  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (const page of sortedPages) {
    // 3a. Full-bleed illustration
    await addImagePage(page.imageUrl);

    // 3b. Text page
    const rawText = (page.text ?? '').trim();
    if (rawText) {
      pdf.addPage('a5', 'portrait');
      fillBg();
      drawBorder();

      const fs = 13;
      pdf.setFont('times', 'normal').setFontSize(fs);
      const lines  = pdf.splitTextToSize(rawText, A5_W - MARGIN * 2 - 10);
      const lineH  = fs * 0.38;
      const blockH = lines.length * lineH * 1.5;
      const startY = (A5_H - blockH) / 2 + lineH;

      pdf.setTextColor(...INK);
      pdf.text(lines, A5_W / 2, startY, { align: 'center', lineHeightFactor: 1.5 });

      // Page number
      pdf.setFont('times', 'italic');
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(String(page.pageNumber), A5_W - MARGIN - 1, A5_H - MARGIN + 1, { align: 'right' });
    }
  }

  // ── 4. The End ────────────────────────────────────────────────────────────
  pdf.addPage('a5', 'portrait');
  fillBg();
  drawBorder();
  pdf.setFont('times', 'bolditalic').setFontSize(32).setTextColor(...INK);
  pdf.text('The End', A5_W / 2, A5_H / 2 - 4, { align: 'center' });
  pdf.setFont('times', 'italic').setFontSize(10).setTextColor(150, 150, 150);
  pdf.text(story.title, A5_W / 2, A5_H / 2 + 12, { align: 'center' });

  // ── Save ─────────────────────────────────────────────────────────────────
  const safeName = story.title.replace(/[^a-z0-9 _-]/gi, '').trim() || 'story';
  pdf.save(`${safeName} - Colouring Book.pdf`);
}

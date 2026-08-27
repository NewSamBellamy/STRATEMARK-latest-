/**
 * Real PDF rendering.
 *
 * The web app has shipped a "PDF" button with no PDF library behind it — there
 * is no jsPDF, no html2canvas, nothing in `apps/web/src` that can produce the
 * format. It exported HTML. Rendering server-side fixes that at the root
 * instead of bolting a second-rate client renderer onto the bundle, and it
 * reuses the Chromium already running here for page capture.
 *
 * The same engine also answers the "PDF or interactive HTML?" question without
 * having to choose: one self-contained HTML document is the source, and the PDF
 * is a print of it. Both artefacts, one template, guaranteed to agree.
 */
import { chromium, type Browser } from 'playwright-core';

export interface RenderPdfOptions {
  /** A complete, self-contained HTML document. Assets must be inlined. */
  html: string;
  landscape?: boolean;
  timeoutMs?: number;
  browserImpl?: Browser;
}

let shared: Browser | null = null;

async function browser(): Promise<Browser> {
  if (shared?.isConnected()) return shared;
  shared = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  return shared;
}

export async function closePdfBrowser(): Promise<void> {
  await shared?.close().catch(() => undefined);
  shared = null;
}

export async function renderPdf(opts: RenderPdfOptions): Promise<Buffer> {
  const b = opts.browserImpl ?? (await browser());
  const context = await b.newContext();
  try {
    const page = await context.newPage();
    // `networkidle` would hang forever on a document with no network at all,
    // which is exactly what a self-contained report is.
    await page.setContent(opts.html, {
      waitUntil: 'domcontentloaded',
      timeout: opts.timeoutMs ?? 20_000,
    });
    // Give webfonts a beat; text reflowing mid-print produces clipped headings.
    await page.waitForTimeout(600);

    const pdf = await page.pdf({
      format: 'Letter',
      landscape: opts.landscape ?? false,
      printBackground: true,
      margin: { top: '0.6in', bottom: '0.6in', left: '0.55in', right: '0.55in' },
    });
    return Buffer.from(pdf);
  } finally {
    await context.close().catch(() => undefined);
  }
}

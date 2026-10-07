// Lectura de texto del PDF con pdfjs-dist (build "legacy" para Node, sin
// DOM ni worker). Solo sirve para PDFs con texto real (los que genera el
// propio portal del SAT o gob.mx) — un PDF que es puro escaneo de imagen no
// trae texto y getTextContent() regresa vacío; eso se refleja como campos
// faltantes más arriba, nunca como un error.
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function loadPdf(buffer) {
  const data = new Uint8Array(buffer);
  const loadingTask = getDocument({ data, isEvalSupported: false, useSystemFonts: true, disableFontFace: true });
  return loadingTask.promise;
}

export async function extractPdfText(pdfDocument, { maxPages = 3 } = {}) {
  const pageCount = Math.min(pdfDocument.numPages, maxPages);
  const pages = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDocument.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }
  return pages.join("\n");
}

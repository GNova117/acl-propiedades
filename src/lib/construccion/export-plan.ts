import { PDFDocument, StandardFonts } from "pdf-lib";
import type { Bounds } from "./geometry";

const EXPORT_MARGIN_M = 0.6;
const EXPORT_COTA_FONT_M = 0.28;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Serializa el <svg> del plano a un PNG (fondo blanco) a `pxPerMeter` de resolución. Con `box` se
 * exporta TODO el contenido (no la parte visible con zoom/desplazamiento) y se quitan la cuadrícula
 * y las asas de edición, que son solo de pantalla.
 */
async function svgToPng(svg: SVGSVGElement, pxPerMeter = 120, box?: Bounds | null): Promise<{ dataUrl: string; width: number; height: number }> {
  const viewBox = box
    ? {
        x: box.minX - EXPORT_MARGIN_M,
        y: box.minZ - EXPORT_MARGIN_M,
        width: box.maxX - box.minX + EXPORT_MARGIN_M * 2,
        height: box.maxZ - box.minZ + EXPORT_MARGIN_M * 2,
      }
    : svg.viewBox.baseVal;
  const width = Math.round(viewBox.width * pxPerMeter);
  const height = Math.round(viewBox.height * pxPerMeter);

  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (box) {
    clone.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    clone.querySelectorAll(".construccion-plan-grid, .construccion-plan-ui").forEach((el) => el.remove());
    // El azul de "habitación seleccionada" es solo de pantalla: en el archivo todos los muros van igual.
    clone.querySelectorAll('line[stroke="#2563eb"]').forEach((el) => el.setAttribute("stroke", "#3f3f46"));
    // Las cotas se dibujan a tamaño de pantalla (dependen del zoom): al exportar vuelven a un tamaño fijo en metros.
    clone.querySelectorAll(".construccion-cota").forEach((el) => el.setAttribute("font-size", String(EXPORT_COTA_FONT_M)));
  }
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo crear el contexto 2D del canvas.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export type PlanExportMeta = {
  nombre: string;
  areaM2: number;
  perimetroM: number;
};

export async function exportPlanAsPng(svg: SVGSVGElement, meta: PlanExportMeta, box?: Bounds | null) {
  const { dataUrl } = await svgToPng(svg, 120, box);
  download(dataUrl, `${meta.nombre || "plano"}.png`);
}

export async function exportPlanAsPdf(svg: SVGSVGElement, meta: PlanExportMeta, box?: Bounds | null) {
  const { dataUrl, width, height } = await svgToPng(svg, 120, box);
  const pngBytes = await (await fetch(dataUrl)).arrayBuffer();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([612, 792]); // carta
  const png = await pdfDoc.embedPng(pngBytes);

  const margin = 40;
  const topTextHeight = 60;
  const maxW = 612 - margin * 2;
  const maxH = 792 - margin * 2 - topTextHeight;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const w = width * scale;
  const h = height * scale;

  page.drawText(meta.nombre || "Plano", { x: margin, y: 792 - margin - 16, size: 18, font });
  page.drawText(`Área: ${meta.areaM2.toFixed(2)} m²   Perímetro: ${meta.perimetroM.toFixed(2)} m`, {
    x: margin,
    y: 792 - margin - 38,
    size: 11,
    font,
  });
  page.drawImage(png, { x: (612 - w) / 2, y: margin, width: w, height: h });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  download(url, `${meta.nombre || "plano"}.pdf`);
  URL.revokeObjectURL(url);
}

// La ficha con membrete (plano, áreas, presupuesto y fotos) vive en
// ./fichaPdf.ts — este archivo se quedó solo con las exportaciones del plano.

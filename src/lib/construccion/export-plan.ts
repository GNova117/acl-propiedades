import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

export type FichaMeta = {
  proyectoNombre: string;
  /** Una entrada por nivel con sus habitaciones (si el proyecto solo tiene un nivel, llega uno solo). */
  niveles: { nombre: string; habitaciones: { nombre: string; areaM2: number; perimetroM: number; exterior: boolean }[] }[];
  /** m² construidos (sin contar las habitaciones de zona "Exterior"). */
  areaTotalM2: number;
  exteriorM2: number;
  nivelAcabado: string;
  precioM2: number;
  valorEstimado: number;
  presupuestoTotal: number;
};

const peso = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

export async function exportFichaPdf(meta: FichaMeta) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);
  const left = 50;
  const gray = rgb(0.45, 0.45, 0.45);
  let y = 792 - 60;

  page.drawText(meta.proyectoNombre || "Proyecto", { x: left, y, size: 22, font: bold });
  y -= 22;
  page.drawText("Ficha técnica y comercial", { x: left, y, size: 11, font, color: gray });
  y -= 34;

  page.drawText("Habitaciones", { x: left, y, size: 13, font: bold });
  y -= 18;
  const variosNiveles = meta.niveles.length > 1;
  for (const nivel of meta.niveles) {
    if (variosNiveles) {
      page.drawText(nivel.nombre, { x: left, y, size: 10.5, font: bold });
      y -= 15;
    }
    for (const h of nivel.habitaciones) {
      const nombre = h.exterior ? `${h.nombre} (exterior)` : h.nombre;
      page.drawText(nombre, { x: left + (variosNiveles ? 12 : 0), y, size: 10.5, font });
      page.drawText(`${h.areaM2.toFixed(2)} m²`, { x: left + 260, y, size: 10.5, font });
      page.drawText(`${h.perimetroM.toFixed(2)} m perímetro`, { x: left + 340, y, size: 10.5, font, color: gray });
      y -= 15;
    }
  }
  y -= 6;
  page.drawText(`Área total construida: ${meta.areaTotalM2.toFixed(2)} m²`, { x: left, y, size: 12, font: bold });
  y -= 16;
  if (meta.exteriorM2 > 0) {
    page.drawText(`+ ${meta.exteriorM2.toFixed(2)} m² de áreas exteriores (no cuentan como construidas)`, { x: left, y, size: 9.5, font, color: gray });
    y -= 16;
  }
  y -= 18;

  page.drawText("Estimación de valor de mercado", { x: left, y, size: 13, font: bold });
  y -= 18;
  page.drawText(`Nivel de acabados: ${meta.nivelAcabado} (${peso(meta.precioM2)}/m²)`, { x: left, y, size: 10.5, font });
  y -= 18;
  page.drawText(`Valor estimado: ${peso(meta.valorEstimado)}`, { x: left, y, size: 13, font: bold });
  y -= 34;

  page.drawText("Presupuesto de materiales", { x: left, y, size: 13, font: bold });
  y -= 18;
  page.drawText(`Total estimado: ${peso(meta.presupuestoTotal)}`, { x: left, y, size: 13, font: bold });
  y -= 26;

  page.drawText("Cifras de referencia para calibrar — ajusta precios y rendimientos en la pestaña Presupuesto.", {
    x: left,
    y,
    size: 8.5,
    font,
    color: gray,
  });

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  download(url, `${meta.proyectoNombre || "ficha"}.pdf`);
  URL.revokeObjectURL(url);
}

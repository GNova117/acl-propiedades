// Ficha de construcción en PDF, sobre la hoja membretada de ACL (mismo patrón
// que src/lib/propertyFichaPdf.js): plano esquemático por nivel, áreas,
// estimación de valor, presupuesto y las fotos con su nota por cuarto.
// Sustituye al exportFichaPdf plano (solo texto, sin membrete) que vivía en
// export-plan.ts.
import { polygonBounds, unionBounds, wallSegmentsFromPolygon, type Bounds } from "./geometry";
import { presupuestoPorZona, type ValorZona, calcularPresupuesto, totalPresupuesto } from "./budget";
import { areasPorZona, esAreaExterior, estadisticasHabitacion, estadisticasProyecto } from "./stats";
import type { FotoHabitacion, Habitacion, MaterialCatalogItem, Proyecto } from "./types";

const TEMPLATE_URL = "/plantilla_acl.pdf";

const MARGIN_LEFT = 60;
const MARGIN_RIGHT = 60;
const TOP_Y = 628;
const BOTTOM_Y = 115;
const PAGE_WIDTH = 612;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const SIZE_TITLE = 14;
const SIZE_SUBTITLE = 11;
const SIZE_BODY = 10;
const SIZE_CAPTION = 8.5;
const LINE_HEIGHT = 15;
const IMAGE_GAP = 10;
const IMAGE_ROW_MAX_HEIGHT = 170;
const PLANO_MAX_HEIGHT = 230;
const PLANO_MARGIN_M = 0.4;

const peso = (n: number) => `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

const SMART_CHARS: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };

function sanitize(text: unknown): string {
  return String(text ?? "")
    .replace(/[‘’“”–—…]/g, (c) => SMART_CHARS[c])
    .replace(/[^\x20-\xFF\n]/g, "");
}

function fileSafe(text: unknown): string {
  return sanitize(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

type PdfFont = { widthOfTextAtSize(text: string, size: number): number };

function wrapText(text: unknown, font: PdfFont, size: number, maxWidth: number): string[] {
  const words = sanitize(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  const pushLongWord = (word: string) => {
    let chunk = "";
    for (const char of word) {
      if (font.widthOfTextAtSize(chunk + char, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk += char;
      }
    }
    return chunk;
  };

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = font.widthOfTextAtSize(word, size) > maxWidth ? pushLongWord(word) : word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// Igual que embedImageFromUrl en propertyFichaPdf.js: normaliza cualquier
// formato a PNG vía canvas antes de incrustarlo. null si la foto no carga
// (URL firmada vencida, red) en vez de tronar toda la ficha.
async function embedImageFromUrl(doc: import("pdf-lib").PDFDocument, url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    const pngBlob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) return null;
    const bytes = new Uint8Array(await pngBlob.arrayBuffer());
    return await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

function fitImage(img: { width: number; height: number }, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
  return { width: img.width * scale, height: img.height * scale };
}

export type FichaConstruccionMeta = {
  proyecto: Proyecto;
  catalogo: MaterialCatalogItem[];
  nivelAcabado: string;
  precioM2: number;
  valorEstimado: number;
  /** Valor desglosado por tipo de zona (opcional). */
  valorZonas?: ValorZona[];
  /** Mismo shape que devuelve getConstruccionFotos: habitacionId -> fotos (con signedUrl ya resuelta). */
  fotosPorHabitacion: Record<string, FotoHabitacion[]>;
};

export async function buildFichaConstruccionPdf(meta: FichaConstruccionMeta, { template }: { template?: ArrayBuffer } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const { proyecto, catalogo, fotosPorHabitacion } = meta;

  let templateBytes: ArrayBuffer;
  if (template) {
    templateBytes = template;
  } else {
    const res = await fetch(TEMPLATE_URL);
    if (!res.ok) throw new Error("No se pudo cargar la plantilla membretada");
    templateBytes = await res.arrayBuffer();
  }

  const doc = await PDFDocument.load(templateBytes);
  const templateDoc = await PDFDocument.load(templateBytes);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.45, 0.45, 0.45);

  let page = doc.getPages()[0];
  let y = TOP_Y;

  const addPage = async () => {
    const [copied] = await doc.copyPages(templateDoc, [0]);
    page = doc.addPage(copied);
    y = TOP_Y;
  };
  const ensureSpace = async (needed: number) => {
    if (y - needed < BOTTOM_Y) await addPage();
  };

  const drawTitle = async (value: string) => {
    await ensureSpace(LINE_HEIGHT * 2);
    const text = sanitize(value);
    page.drawText(text, { x: MARGIN_LEFT, y, size: SIZE_TITLE, font: bold, color: black });
    const width = bold.widthOfTextAtSize(text, SIZE_TITLE);
    page.drawLine({ start: { x: MARGIN_LEFT, y: y - 3 }, end: { x: MARGIN_LEFT + width, y: y - 3 }, thickness: 1, color: black });
    y -= LINE_HEIGHT * 2;
  };

  const drawSubtitle = async (value: string) => {
    await ensureSpace(LINE_HEIGHT * 1.6);
    const text = sanitize(value);
    const width = bold.widthOfTextAtSize(text, SIZE_SUBTITLE);
    const x = MARGIN_LEFT + Math.max(0, (CONTENT_WIDTH - width) / 2);
    page.drawText(text, { x, y, size: SIZE_SUBTITLE, font: bold, color: black });
    y -= LINE_HEIGHT * 1.6;
  };

  const drawField = async (label: string, value: string) => {
    const labelText = `${sanitize(label)}: `;
    const labelWidth = regular.widthOfTextAtSize(labelText, SIZE_BODY);
    const valueText = sanitize(value);
    await ensureSpace(LINE_HEIGHT);
    page.drawText(labelText, { x: MARGIN_LEFT, y, size: SIZE_BODY, font: regular, color: black });
    page.drawText(valueText, { x: MARGIN_LEFT + labelWidth, y, size: SIZE_BODY, font: bold, color: black });
    y -= LINE_HEIGHT;
  };

  const drawParagraph = async (value: string, { color = black, size = SIZE_BODY }: { color?: ReturnType<typeof rgb>; size?: number } = {}) => {
    for (const line of wrapText(value, regular, size, CONTENT_WIDTH)) {
      await ensureSpace(size + 5);
      page.drawText(line, { x: MARGIN_LEFT, y, size, font: regular, color });
      y -= size + 5;
    }
  };

  // Fila de 2 columnas: nombre a la izquierda, valor numérico alineado a la derecha.
  const drawRow = async (left: string, right: string, { boldLeft = false }: { boldLeft?: boolean } = {}) => {
    await ensureSpace(LINE_HEIGHT);
    page.drawText(sanitize(left), { x: MARGIN_LEFT, y, size: SIZE_BODY, font: boldLeft ? bold : regular, color: black });
    const rightWidth = bold.widthOfTextAtSize(sanitize(right), SIZE_BODY);
    page.drawText(sanitize(right), { x: MARGIN_LEFT + CONTENT_WIDTH - rightWidth, y, size: SIZE_BODY, font: bold, color: black });
    y -= LINE_HEIGHT;
  };

  // Plano esquemático: muros de cada habitación del nivel, a escala, con el
  // nombre al centro. Se dibuja con vectores directo del polígono guardado
  // (no una captura del editor), así que no hace falta tener la pantalla abierta.
  const drawPlano = async (habitaciones: Habitacion[]) => {
    const conPuntos = habitaciones.filter((h) => h.puntos.length >= 2);
    if (conPuntos.length === 0) return;
    const bounds = unionBounds(conPuntos.map((h) => polygonBounds(h.puntos))) as Bounds;
    const boundsWidth = bounds.maxX - bounds.minX + PLANO_MARGIN_M * 2;
    const boundsHeight = bounds.maxZ - bounds.minZ + PLANO_MARGIN_M * 2;
    const scale = Math.min(CONTENT_WIDTH / boundsWidth, PLANO_MAX_HEIGHT / boundsHeight);
    const drawWidth = boundsWidth * scale;
    const drawHeight = boundsHeight * scale;
    await ensureSpace(drawHeight);

    const offsetX = MARGIN_LEFT + (CONTENT_WIDTH - drawWidth) / 2;
    const topY = y;
    const px = (x: number) => offsetX + (x - bounds.minX + PLANO_MARGIN_M) * scale;
    const py = (z: number) => topY - (z - bounds.minZ + PLANO_MARGIN_M) * scale;

    for (const h of conPuntos) {
      for (const seg of wallSegmentsFromPolygon(h.puntos)) {
        page.drawLine({
          start: { x: px(seg.start.x), y: py(seg.start.z) },
          end: { x: px(seg.end.x), y: py(seg.end.z) },
          thickness: 1.2,
          color: black,
        });
      }
      const cx = h.puntos.reduce((s, p) => s + p.x, 0) / h.puntos.length;
      const cz = h.puntos.reduce((s, p) => s + p.z, 0) / h.puntos.length;
      const label = sanitize(h.nombre);
      const labelWidth = regular.widthOfTextAtSize(label, 7);
      page.drawText(label, { x: px(cx) - labelWidth / 2, y: py(cz), size: 7, font: regular, color: gray });
    }

    y -= drawHeight + IMAGE_GAP;
  };

  // Fila de fotos con su nota debajo de cada una (a diferencia de
  // propertyFichaPdf.js, aquí cada imagen lleva su propio texto).
  const drawPhotoRow = async (items: { img: NonNullable<Awaited<ReturnType<typeof embedImageFromUrl>>>; caption: string }[]) => {
    const boxWidth = items.length === 1 ? CONTENT_WIDTH : (CONTENT_WIDTH - IMAGE_GAP) / 2;
    const fitted = items.map((it) => fitImage(it.img, boxWidth, IMAGE_ROW_MAX_HEIGHT));
    const captionLines = items.map((it) => (it.caption ? wrapText(it.caption, regular, SIZE_CAPTION, boxWidth) : []));
    const maxCaptionLines = Math.max(1, ...captionLines.map((lines) => lines.length));
    const rowHeight = Math.max(...fitted.map((f) => f.height));
    await ensureSpace(rowHeight + maxCaptionLines * (SIZE_CAPTION + 3) + 6);

    let x = MARGIN_LEFT;
    items.forEach((item, i) => {
      const { width: w, height } = fitted[i];
      page.drawImage(item.img, { x, y: y - height, width: w, height });
      let capY = y - height - SIZE_CAPTION - 2;
      for (const line of captionLines[i]) {
        page.drawText(line, { x, y: capY, size: SIZE_CAPTION, font: regular, color: gray });
        capY -= SIZE_CAPTION + 3;
      }
      x += boxWidth + IMAGE_GAP;
    });
    y -= rowHeight + maxCaptionLines * (SIZE_CAPTION + 3) + 10;
  };

  // ── Encabezado ──
  await drawTitle("FICHA DE CONSTRUCCION");
  await drawSubtitle(sanitize(proyecto.nombre).toUpperCase());
  if (proyecto.cliente) await drawField("Cliente", proyecto.cliente);
  if (proyecto.direccion) await drawField("Direccion", proyecto.direccion);

  // ── Plano, áreas por nivel ──
  const stats = estadisticasProyecto(proyecto);
  const variosNiveles = proyecto.niveles.length > 1;
  y -= LINE_HEIGHT * 0.5;
  await drawSubtitle("PLANO Y AREAS");
  for (const nivel of proyecto.niveles) {
    const habsDelNivel = proyecto.habitaciones.filter((h) => h.nivelId === nivel.id);
    if (habsDelNivel.length === 0) continue;
    if (variosNiveles) {
      y -= LINE_HEIGHT * 0.3;
      page.drawText(sanitize(nivel.nombre), { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
      y -= LINE_HEIGHT;
    }
    await drawPlano(habsDelNivel);
    for (const h of habsDelNivel) {
      const e = estadisticasHabitacion(h, proyecto.objetos);
      const nombre = esAreaExterior(h) ? `${h.nombre} (exterior)` : h.nombre;
      await drawRow(nombre, `${e.areaM2.toFixed(2)} m2`);
    }
  }
  y -= LINE_HEIGHT * 0.3;
  await drawRow("Area total construida", `${stats.construidaM2.toFixed(2)} m2`, { boldLeft: true });
  if (stats.exteriorM2 > 0) await drawParagraph(`+ ${stats.exteriorM2.toFixed(2)} m2 de areas exteriores (no cuentan como construidas)`, { color: gray, size: 9 });

  // ── Áreas por tipo de zona (oficinas, salas de juntas…) — solo si hay más de un uso ──
  const porZona = areasPorZona(proyecto.habitaciones);
  if (porZona.length > 1) {
    y -= LINE_HEIGHT * 0.5;
    await drawSubtitle("AREAS POR TIPO DE ZONA");
    for (const z of porZona) await drawRow(z.zonas > 1 ? `${z.nombre} (${z.zonas})` : z.nombre, `${z.areaM2.toFixed(2)} m2`);
  }

  // ── Estimación de valor y presupuesto ──
  y -= LINE_HEIGHT * 0.5;
  await drawSubtitle("ESTIMACION DE VALOR Y PRESUPUESTO");
  await drawField("Nivel de acabados", `${meta.nivelAcabado} (${peso(meta.precioM2)}/m2)`);
  if (meta.valorZonas && meta.valorZonas.length > 1) {
    for (const z of meta.valorZonas) {
      await drawRow(`${z.nombre}${z.zonas > 1 ? ` (${z.zonas})` : ""} - ${z.areaM2.toFixed(1)} m2 x ${peso(z.precioM2)}`, peso(z.valor));
    }
  }
  await drawRow("Valor estimado", peso(meta.valorEstimado), { boldLeft: true });
  const presupuestoTotal = proyecto.habitaciones.reduce((sum, h) => sum + totalPresupuesto(calcularPresupuesto(h, catalogo)), 0);
  const costoZonas = presupuestoPorZona(proyecto.habitaciones, catalogo);
  if (costoZonas.length > 1) {
    for (const z of costoZonas) await drawRow(`Materiales: ${z.nombre}${z.zonas > 1 ? ` (${z.zonas})` : ""}`, peso(z.costo));
  }
  await drawRow("Presupuesto de materiales", peso(presupuestoTotal), { boldLeft: true });
  await drawParagraph("Cifras de referencia para calibrar — desglose completo por material en el CSV exportable junto a este PDF.", { color: gray, size: 9 });

  // ── Fotografías por cuarto ──
  const habitacionesConFotos = proyecto.habitaciones.filter((h) => (fotosPorHabitacion[h.id]?.length ?? 0) > 0);
  if (habitacionesConFotos.length > 0) {
    y -= LINE_HEIGHT * 0.5;
    await drawSubtitle("FOTOGRAFIAS");
    for (const h of habitacionesConFotos) {
      await ensureSpace(LINE_HEIGHT * 1.4);
      page.drawText(sanitize(h.nombre), { x: MARGIN_LEFT, y, size: SIZE_BODY, font: bold, color: black });
      y -= LINE_HEIGHT * 1.2;

      const fotos = fotosPorHabitacion[h.id] ?? [];
      const embedded: { img: NonNullable<Awaited<ReturnType<typeof embedImageFromUrl>>>; caption: string }[] = [];
      for (const foto of fotos) {
        if (!foto.signedUrl) continue;
        const img = await embedImageFromUrl(doc, foto.signedUrl);
        if (img) embedded.push({ img, caption: foto.nota ?? "" });
      }
      if (embedded.length === 0) {
        await drawParagraph("No fue posible cargar las fotos de este cuarto (la URL pudo haber vencido).", { color: gray, size: 9 });
        continue;
      }
      for (let i = 0; i < embedded.length; i += 2) await drawPhotoRow(embedded.slice(i, i + 2));
    }
  }

  return doc.save();
}

export async function downloadFichaConstruccionPdf(meta: FichaConstruccionMeta) {
  const bytes = await buildFichaConstruccionPdf(meta);
  const blob = new Blob([(bytes as Uint8Array).slice().buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `FichaConstruccion_${fileSafe(meta.proyecto.nombre) || "proyecto"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

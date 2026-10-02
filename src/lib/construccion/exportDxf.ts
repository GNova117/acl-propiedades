// Exportación a DXF (ASCII, estilo R12) del plano — sin librería: un DXF de
// solo LINEs (muros) y TEXT (nombre + área de cada cuarto) es un formato de
// texto simple y no hace falta más para abrirlo en AutoCAD/LibreCAD/QCAD. No
// se incluyen HEADER/TABLES: un lector de DXF crea las capas ("8") que no
// conoce, así que ENTITIES solo ya es un archivo válido.
import { polygonArea, wallSegmentsFromPolygon } from "./geometry";
import type { Habitacion } from "./types";

const TEXT_HEIGHT_M = 0.22;

// Las coordenadas del plano van en (x, z) con z creciendo "hacia abajo" en
// pantalla; un DXF usa (x, y) con y creciendo hacia arriba, así que se invierte.
const toDxfY = (z: number) => -z;

function sanitizeDxfText(text: string): string {
  return String(text ?? "").replace(/[\r\n]+/g, " ").slice(0, 120);
}

function line(start: { x: number; y: number }, end: { x: number; y: number }, layer: string): string[] {
  return ["0", "LINE", "8", layer, "10", String(start.x), "20", String(start.y), "30", "0", "11", String(end.x), "21", String(end.y), "31", "0"];
}

function text(x: number, y: number, value: string, layer: string, height = TEXT_HEIGHT_M): string[] {
  return ["0", "TEXT", "8", layer, "10", String(x), "20", String(y), "30", "0", "40", String(height), "1", sanitizeDxfText(value)];
}

/** Construye el texto DXF de las habitaciones dadas (ya filtradas al nivel que se exporta). */
export function buildDxf(habitaciones: Habitacion[]): string {
  const lines: string[] = ["0", "SECTION", "2", "ENTITIES"];

  for (const h of habitaciones) {
    if (h.puntos.length < 2) continue;
    const layer = `CUARTO_${h.tipo ?? "otro"}`.toUpperCase();
    for (const seg of wallSegmentsFromPolygon(h.puntos)) {
      lines.push(...line({ x: seg.start.x, y: toDxfY(seg.start.z) }, { x: seg.end.x, y: toDxfY(seg.end.z) }, layer));
    }
    const areaM2 = polygonArea(h.puntos);
    const cx = h.puntos.reduce((s, p) => s + p.x, 0) / h.puntos.length;
    const cz = h.puntos.reduce((s, p) => s + p.z, 0) / h.puntos.length;
    lines.push(...text(cx, toDxfY(cz), `${h.nombre} (${areaM2.toFixed(2)} m2)`, layer));
  }

  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\n");
}

export function downloadDxf(habitaciones: Habitacion[], nombreArchivo: string) {
  const content = buildDxf(habitaciones);
  const blob = new Blob([content], { type: "application/dxf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo || "plano"}.dxf`;
  a.click();
  URL.revokeObjectURL(url);
}

// Export a CSV del presupuesto de materiales, línea por línea (nivel, cuarto,
// material, cantidad, costo) — sin librería: un CSV es texto con comillas
// donde haga falta, nada que amerite una dependencia.
import { calcularPresupuesto, presupuestoPorZona, totalPresupuesto } from "./budget";
import { zonaDe } from "./objetos";
import type { MaterialCatalogItem, Proyecto } from "./types";

const HEADERS = ["Nivel", "Habitación", "Tipo de zona", "Material", "Unidad", "Cantidad", "Precio unitario", "Costo"];

// Comillas dobles solo si el campo las necesita (coma, comilla o salto de línea).
function csvField(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(",");
}

export function buildPresupuestoCsv(proyecto: Proyecto, catalogo: MaterialCatalogItem[]): string {
  const rows: string[] = [csvRow(HEADERS)];
  let granTotal = 0;

  for (const nivel of proyecto.niveles) {
    for (const h of proyecto.habitaciones.filter((hab) => hab.nivelId === nivel.id)) {
      const lineas = calcularPresupuesto(h, catalogo);
      for (const l of lineas) {
        rows.push(csvRow([nivel.nombre, h.nombre, zonaDe(h.tipo).nombre, l.material.nombre, l.material.unidad, l.cantidad.toFixed(2), l.material.precioUnitario.toFixed(2), l.costo.toFixed(2)]));
      }
      granTotal += totalPresupuesto(lineas);
    }
  }

  rows.push(csvRow(["", "", "", "", "", "", "TOTAL", granTotal.toFixed(2)]));
  // Resumen por tipo de zona (oficinas, baños, bodega…), por si se quiere comparar el costo por uso.
  const porZona = presupuestoPorZona(proyecto.habitaciones, catalogo);
  if (porZona.length > 1) {
    rows.push("");
    rows.push(csvRow(["Resumen por tipo de zona", "", "", "m2", "", "", "", "Costo"]));
    for (const z of porZona) rows.push(csvRow([z.nombre + (z.zonas > 1 ? ` (${z.zonas})` : ""), "", "", z.areaM2.toFixed(2), "", "", "", z.costo.toFixed(2)]));
  }
  // BOM al inicio: sin él, Excel en Windows adivina Latin-1 y los acentos salen mal.
  return `﻿${rows.join("\r\n")}`;
}

export function downloadPresupuestoCsv(proyecto: Proyecto, catalogo: MaterialCatalogItem[]) {
  const csv = buildPresupuestoCsv(proyecto, catalogo);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${proyecto.nombre || "presupuesto"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

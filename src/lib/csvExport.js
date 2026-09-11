// Genera y descarga un CSV a partir de un arreglo de objetos + columnas —
// usado por los botones "Exportar CSV" del admin (Clientes, Propiedades).
// Escapa comillas/comas/saltos de línea (RFC 4180) y antepone un BOM UTF-8
// para que Excel en Windows muestre bien los acentos sin que el usuario
// tenga que elegir la codificación al abrir el archivo.
function escapeCsvValue(value) {
  const str = value == null ? "" : String(value);
  if (/["\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// `columns`: [{ label, key }] lee row[key] directo, o [{ label, value: (row) => ... }]
// para valores calculados/traducidos (ej. mostrar la etiqueta legible de un
// enum en vez de su clave interna).
export function exportToCsv(filename, rows, columns) {
  const header = columns.map((c) => escapeCsvValue(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(c.value ? c.value(row) : row[c.key])).join(",")
  );
  const csv = [header, ...lines].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

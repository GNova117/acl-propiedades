// «Mis ventas y comisiones» del asesor: sus ventas por mes y lo que le tocó cobrar de cada una. Funciones puras; la pantalla solo
// trae los datos y pinta el resultado.
//
// De dónde sale cada cosa:
//   ventas        — las ventas que el asesor registró como suyas (ventas.advisor_id; RLS ya deja leer solo esas).
//   comisiones    — advisor_commissions: lo que la oficina PUBLICÓ para el asesor (ver «Publicar comisiones» en Reportes). La
//                   liquidación completa es confidencial; el asesor solo recibe su monto, no la utilidad ni lo de nadie más.
//   propiedades   — el precio es el vigente de la propiedad (igual que «Mis ventas» del Panel principal).
// Una persona puede aparecer en una venta sin haberla cerrado (captó la propiedad y la vendió otro): esa fila trae su comisión de
// captación pero no cuenta como venta suya ni suma al volumen.

// Identidad de una comisión publicada: una por casa, persona y concepto (captación o venta).
export const commissionKey = (c) => `${c.property_id}|${c.advisor_id}|${c.role}`;

const byDateDesc = (a, b) => String(b.fecha).localeCompare(String(a.fecha));

// Una fila por propiedad en la que el asesor vendió o cobró algo, lo más reciente primero.
//   { propertyId, property, fecha, price, sold, roles: ("captacion"|"venta")[], commission: number | null }
// `commission` es null mientras la oficina no publique la suya (se muestra «pendiente», no «$0»).
export function buildMySales({ ventas = [], properties = [], commissions = [], advisorId }) {
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const rows = new Map();
  const rowFor = (propertyId, fecha) => {
    if (!rows.has(propertyId)) {
      const property = propertyById.get(propertyId) || null;
      rows.set(propertyId, { propertyId, property, fecha: fecha || "", price: Number(property?.price) || 0, sold: false, roles: [], commission: null });
    }
    return rows.get(propertyId);
  };

  for (const venta of ventas) {
    if (venta.advisor_id !== advisorId) continue;
    const row = rowFor(venta.property_id, venta.fecha_venta);
    row.sold = true;
    row.fecha = venta.fecha_venta || row.fecha;
  }
  for (const c of commissions) {
    if (c.advisor_id !== advisorId) continue;
    const row = rowFor(c.property_id, c.fecha_venta);
    if (!row.fecha) row.fecha = c.fecha_venta || "";
    row.commission = (row.commission ?? 0) + (Number(c.amount) || 0);
    if (!row.roles.includes(c.role)) row.roles.push(c.role);
  }
  for (const row of rows.values()) row.roles.sort((a, b) => (a === "captacion" ? -1 : 1) - (b === "captacion" ? -1 : 1));
  return [...rows.values()].filter((row) => row.fecha).sort(byDateDesc);
}

const yearOf = (fecha) => Number(String(fecha).slice(0, 4));
const monthOf = (fecha) => Number(String(fecha).slice(5, 7)) - 1;

// Años con algo que mostrar, el más reciente primero; siempre incluye el año en curso.
export function salesYears(rows, now = new Date()) {
  const years = new Set([now.getFullYear(), ...rows.map((r) => yearOf(r.fecha)).filter(Number.isFinite)]);
  return [...years].sort((a, b) => b - a);
}

// Resumen de un año: cifras totales y por mes (12 posiciones, enero = 0).
//   count / volume — ventas cerradas por el asesor (no cuentan las filas donde solo captó)
//   commission     — suma de lo publicado
//   pending        — ventas suyas del año cuya comisión aún no se publica
export function summarizeYear(rows, year) {
  const months = Array.from({ length: 12 }, () => ({ count: 0, volume: 0, commission: 0 }));
  const summary = { year, count: 0, volume: 0, commission: 0, pending: 0, months };
  for (const row of rows) {
    if (yearOf(row.fecha) !== year) continue;
    const month = months[monthOf(row.fecha)];
    if (row.sold) {
      summary.count += 1;
      summary.volume += row.price;
      month.count += 1;
      month.volume += row.price;
      if (row.commission == null) summary.pending += 1;
    }
    if (row.commission != null) {
      summary.commission += row.commission;
      month.commission += row.commission;
    }
  }
  return summary;
}

export const rowsOfYear = (rows, year) => rows.filter((r) => yearOf(r.fecha) === year);

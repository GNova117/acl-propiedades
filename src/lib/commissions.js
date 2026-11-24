// Comisiones por asesor: de la liquidación de una propiedad (lib/liquidacion.js) salen hasta dos comisiones, la de
// captación (para quien captó) y la de venta (para quien vendió, solo si es otra persona). Aquí se arman esas líneas, se
// valida el pago y se suman por asesor. Funciones puras. Los montos se guardan como foto al momento de registrarlos.

export const COMMISSION_CONCEPTS = ["captacion", "venta"];
export const COMMISSION_STATUSES = ["pendiente", "pagada"];

const toPesos = (n) => Math.max(0, Math.round(Number(n) || 0));

// calc: salida de computeLiquidacion. → [{ concept, advisor_id, amount }] (sin líneas de cero ni sin asesor).
export function commissionLines(calc, { captadorId, vendedorId } = {}) {
  const lines = [];
  if (captadorId && toPesos(calc?.montoCaptador) > 0) lines.push({ concept: "captacion", advisor_id: captadorId, amount: toPesos(calc.montoCaptador) });
  if (vendedorId && !calc?.mismaPersona && toPesos(calc?.comisionVenta) > 0) lines.push({ concept: "venta", advisor_id: vendedorId, amount: toPesos(calc.comisionVenta) });
  return lines;
}

// Pagar exige una fecha de pago (la base lo exige igual); no puede ser futura.
export function validatePayment(paidOn, today = new Date().toLocaleDateString("en-CA")) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(paidOn || ""))) return { error: "date" };
  if (paidOn > today) return { error: "future" };
  return { value: paidOn };
}

// Totales por asesor: { advisor_id, pending, paid, count }. Orden: más pendiente primero.
export function summarizeByAdvisor(rows) {
  const map = new Map();
  for (const row of rows) {
    const entry = map.get(row.advisor_id) || { advisor_id: row.advisor_id, pending: 0, paid: 0, count: 0 };
    entry[row.status === "pagada" ? "paid" : "pending"] += Number(row.amount) || 0;
    entry.count += 1;
    map.set(row.advisor_id, entry);
  }
  return [...map.values()].sort((a, b) => b.pending - a.pending || b.paid - a.paid);
}

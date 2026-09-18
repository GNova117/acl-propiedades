// Bitácora y gastos por propiedad (uso interno). Funciones puras: nada de lo
// que se calcula aquí (totales, acumulados, avance contra presupuesto) se
// guarda — se recalcula al vuelo de las entradas, así corregir un monto o
// borrar un gasto siempre deja los resúmenes cuadrados.
//
// Una entrada es una `nota` (evento, sin dinero) o un `gasto` (con monto y,
// idealmente, un comprobante adjunto). Solo los gastos suman.

export const LOG_CATEGORIES = ["predial", "agua", "luz", "gas", "mantenimiento", "remodelacion", "tramites", "otro"];

// Los gastos de esta categoría se comparan contra el presupuesto de
// remodelación (total de materiales del proyecto ligado); el resto solo
// contra el presupuesto propio de la casa.
export const REMODEL_CATEGORY = "remodelacion";

// Avanza a "cerca del límite" a partir de este porcentaje del presupuesto.
export const BUDGET_WARN_PCT = 90;

// Tope de tamaño del comprobante. Storage (plan Free) aplica hasta 50 MB de
// verdad; se pide menos a propósito: un ticket o recibo no lo necesita.
export const MAX_FILE_MB = 20;
export const FILE_ACCEPT_ATTR = "image/*,application/pdf";

const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "pdf"];

// Un recibo trae centavos ($1,250.50): a diferencia del resto del panel, aquí
// no se redondea a pesos enteros.
export function formatMoney(value) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export function amount(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

// Devuelve la clave i18n del problema (bajo propertyLog.fileErrors.*) o null.
export function validateLogFile(file) {
  if (!file) return null;
  const ext = file.name?.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
  const typeOk = file.type ? file.type.startsWith("image/") || file.type === "application/pdf" : ACCEPTED_EXTENSIONS.includes(ext);
  if (!typeOk) return "type";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return "size";
  return null;
}

// Errores de campo del formulario, como { campo: true } — la pantalla los
// traduce a "campo requerido"/"monto inválido".
export function validateLogForm(form) {
  const errors = {};
  if (!form.entry_date) errors.entry_date = "required";
  if (form.kind === "gasto") {
    if (!form.categoria) errors.categoria = "required";
    if (!form.concepto.trim()) errors.concepto = "required";
    if (!(amount(form.monto) > 0)) errors.monto = "amount";
  } else if (!form.descripcion.trim()) {
    errors.descripcion = "required";
  }
  return errors;
}

export function toLogFields(form) {
  const isGasto = form.kind === "gasto";
  return {
    kind: form.kind,
    entry_date: form.entry_date,
    categoria: form.categoria || null,
    concepto: isGasto ? form.concepto.trim() || null : null,
    descripcion: form.descripcion.trim() || null,
    monto: isGasto ? amount(form.monto) : null,
  };
}

export function sumExpenses(entries, categoria = null) {
  return entries
    .filter((e) => e.kind === "gasto" && (categoria == null || e.categoria === categoria))
    .reduce((sum, e) => sum + Number(e.monto || 0), 0);
}

// Gasto por categoría, de mayor a menor. Un gasto sin categoría (no debería
// pasar: el formulario la exige) cae en "otro" en vez de desaparecer.
export function expensesByCategory(entries) {
  const totals = new Map();
  for (const e of entries) {
    if (e.kind !== "gasto") continue;
    const key = e.categoria || "otro";
    const row = totals.get(key) || { categoria: key, total: 0, count: 0 };
    row.total += Number(e.monto || 0);
    row.count += 1;
    totals.set(key, row);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

// Agrupa por día (más reciente primero). `cumulative` es el gasto acumulado
// desde la primera entrada hasta el cierre de ese día, calculado sobre TODA
// la historia — no cambia al filtrar la vista.
export function groupByDay(entries) {
  const byDate = new Map();
  for (const e of entries) {
    if (!byDate.has(e.entry_date)) byDate.set(e.entry_date, []);
    byDate.get(e.entry_date).push(e);
  }
  const ascending = [...byDate.keys()].sort();
  let running = 0;
  const days = ascending.map((date) => {
    const dayEntries = byDate.get(date).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const dayTotal = sumExpenses(dayEntries);
    running += dayTotal;
    return { date, entries: dayEntries, dayTotal, cumulative: running };
  });
  return days.reverse();
}

// Avance de lo gastado contra un presupuesto. null si no hay presupuesto
// contra el cual comparar (0 o vacío) — se muestra como "sin presupuesto",
// no como 0%.
export function budgetStatus(spent, budget) {
  const total = Number(budget) || 0;
  if (!(total > 0)) return null;
  const pct = (spent / total) * 100;
  return {
    pct,
    remaining: total - spent,
    level: spent > total ? "over" : pct >= BUDGET_WARN_PCT ? "warn" : "ok",
  };
}

export function logMonths(entries) {
  return [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))].sort().reverse();
}

export function formatIsoDate(iso, language, options = { day: "numeric", month: "short", year: "numeric" }) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(language?.startsWith("en") ? "en-US" : "es-MX", options);
}

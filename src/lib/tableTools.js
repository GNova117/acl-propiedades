// Herramientas de las tablas del panel: ordenar por columna y elegir qué columnas se ven. Funciones puras (salvo guardar
// en el dispositivo). El orden y las columnas elegidas se recuerdan en ESTE dispositivo (localStorage), por tabla.

const collator = new Intl.Collator("es", { sensitivity: "base", numeric: true });

// Orden al pulsar el encabezado de una columna: sin orden → ascendente → descendente → sin orden.
export function nextSort(current, key) {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

export const ariaSort = (sort, key) => (sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");

const isBlank = (v) => v == null || v === "";

function compareValues(a, b) {
  if (typeof a === "boolean" || typeof b === "boolean") return Number(Boolean(a)) - Number(Boolean(b));
  if (typeof a === "number" && typeof b === "number") return a - b;
  const da = typeof a === "string" && /^\d{4}-\d{2}-\d{2}/.test(a) ? Date.parse(a) : NaN;
  const db = typeof b === "string" && /^\d{4}-\d{2}-\d{2}/.test(b) ? Date.parse(b) : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(db)) return da - db;
  return collator.compare(String(a), String(b));
}

// `accessors`: { columna: (fila) => valor }. Sin orden (null) devuelve las filas como vienen. Lo vacío va SIEMPRE al
// final, en los dos sentidos, y el orden es estable (las filas iguales conservan su orden).
export function sortRows(rows, sort, accessors) {
  const get = sort && accessors[sort.key];
  if (!get) return rows;
  const sign = sort.dir === "desc" ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((x, y) => {
      const xb = isBlank(x.value);
      const yb = isBlank(y.value);
      if (xb || yb) return xb === yb ? x.index - y.index : xb ? 1 : -1;
      return sign * compareValues(x.value, y.value) || x.index - y.index;
    })
    .map((e) => e.row);
}

// ── Columnas que se ven ──
const key = (table) => `acl.tableColumns.${table}`;
const defaultStorage = () => (typeof localStorage !== "undefined" ? localStorage : null);

// Las ocultas (Set). `known`: las columnas que existen hoy y se pueden ocultar (lo guardado que ya no existe se ignora).
export function loadHiddenColumns(table, known, storage = defaultStorage()) {
  try {
    const raw = JSON.parse(storage?.getItem(key(table)) || "[]");
    return new Set((Array.isArray(raw) ? raw : []).filter((c) => known.includes(c)));
  } catch {
    return new Set();
  }
}

export function saveHiddenColumns(table, hidden, storage = defaultStorage()) {
  try {
    storage?.setItem(key(table), JSON.stringify([...hidden]));
  } catch {
    // sin almacenamiento: vale mientras la pantalla siga abierta
  }
}

export function toggleColumn(hidden, column, known) {
  if (!known.includes(column)) return hidden;
  const next = new Set(hidden);
  if (next.has(column)) next.delete(column);
  else next.add(column);
  return next;
}

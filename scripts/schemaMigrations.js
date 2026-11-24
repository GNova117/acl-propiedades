// supabase/schema.sql nació como UN archivo que se pega en el SQL Editor; con el tiempo llegó a 8,000+ líneas y 110+ bloques.
// Ahora cada bloque es una migración (supabase/migrations/NNNN_titulo.sql, en orden) y schema.sql se GENERA uniéndolas
// (`npm run schema:build`), así el flujo de siempre (pegar el archivo completo) sigue sirviendo y lo nuevo se puede aplicar
// por migraciones sin repetir lo ya hecho (scripts/migrate.mjs). Esta parte es pura: partir, nombrar y volver a unir.
const RULE = "-- ───";

const isRule = (line) => line.startsWith(RULE);

// Un encabezado de bloque es: línea de ───, una o más líneas de comentario, otra línea de ───.
function headerStarts(lines) {
  const rules = lines.flatMap((line, i) => (isRule(line) ? [i] : []));
  const starts = [];
  for (let k = 0; k < rules.length; ) {
    const open = rules[k];
    const close = rules[k + 1];
    const between = close === undefined ? [] : lines.slice(open + 1, close);
    if (between.length > 0 && between.every((l) => l.startsWith("--"))) {
      starts.push(open);
      k += 2;
    } else {
      k += 1;
    }
  }
  return starts;
}

export function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // quita «(2026-11-18)» y aclaraciones entre paréntesis
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)
    .replace(/_+$/g, "");
}

// Parte schema.sql en bloques. → [{ title, sql }] ; unirlos (join("")) devuelve el archivo EXACTO.
export function splitSchema(text) {
  const lines = String(text).split("\n");
  const starts = headerStarts(lines);
  const bounds = [0, ...starts.filter((s) => s > 0)];
  const chunks = bounds.map((from, i) => {
    const to = i + 1 < bounds.length ? bounds[i + 1] : lines.length;
    const body = lines.slice(from, to).join("\n");
    return i + 1 < bounds.length ? `${body}\n` : body;
  });
  return chunks.map((sql, i) => {
    const sqlLines = sql.split("\n");
    const titleLine = i === 0 ? sqlLines.find((l) => l.startsWith("--")) : sqlLines.slice(1).find((l) => l.startsWith("--"));
    const title = (titleLine || "").replace(/^--\s*/, "").trim() || `bloque ${i + 1}`;
    return { title: i === 0 ? "Esquema base" : title, sql };
  });
}

export const migrationFileName = (index, title) => `${String(index + 1).padStart(4, "0")}_${slugify(title) || "bloque"}.sql`;

// «0007_listado_y_ficha.sql» → { version: "0007", name: "listado_y_ficha" } (o null si no es una migración)
export function parseMigrationFileName(file) {
  const match = /^(\d{4,})_([a-z0-9_]+)\.sql$/.exec(String(file));
  return match ? { version: match[1], name: match[2] } : null;
}

// ¿El bloque dice ser re-ejecutable? (los de la primera época no lo eran: ver README de migraciones)
export const claimsReexecutable = (sql) => /re-ejecutable/i.test(sql);

// Qué migraciones faltan por aplicar. `files`: nombres de archivo; `applied`: versiones ya aplicadas; `to`: versión tope (opcional).
// Falla si lo aplicado no es un prefijo del orden (una migración intermedia sin aplicar), porque aplicar fuera de orden en un
// esquema que se construye por capas puede dejarlo a medias.
export function planMigrations(files, applied, { to } = {}) {
  const all = files.map((file) => ({ file, ...parseMigrationFileName(file) })).filter((m) => m.version).sort((a, b) => a.version.localeCompare(b.version));
  const done = new Set(applied);
  const firstPending = all.findIndex((m) => !done.has(m.version));
  const gap = firstPending === -1 ? [] : all.slice(firstPending + 1).filter((m) => done.has(m.version));
  if (gap.length) {
    throw new Error(`Hay migraciones aplicadas después de una pendiente (${all[firstPending].version}): ${gap.map((m) => m.version).join(", ")}. Revisa el orden antes de seguir.`);
  }
  const unknown = [...done].filter((version) => !all.some((m) => m.version === version));
  if (unknown.length) throw new Error(`La base tiene migraciones que no existen en el repositorio: ${unknown.join(", ")}.`);
  const pending = firstPending === -1 ? [] : all.slice(firstPending);
  return to ? pending.filter((m) => m.version <= to) : pending;
}

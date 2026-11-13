// «Le encaja a tu prospecto» por push: qué avisar a cada asesor cuando entra una propiedad nueva o baja de precio y le va a alguno
// de sus prospectos abiertos. Funciones puras, sin Deno ni Supabase, para poder probarlas con vitest (igual que visitEmail.js); las
// usa la Edge Function prospecto-coincidencias (cada hora, de 8 am a 8 pm hora de México).
//
// La coincidencia es la misma del panel (src/lib/prospectMatch.js + alertMatch.js): los criterios de búsqueda del prospecto contra
// la propiedad, y quien busca una ciudad ve también sus colonias. Está duplicada aquí porque la función no puede importar de src/;
// prospectMatchPush.test.js compara ambas con los mismos datos.

export const OPEN_STAGES = ["nuevo", "contactado", "interesado", "negociacion"];
export const LAGUNA_CITIES = ["Torreón", "Gómez Palacio", "Lerdo"];
// Cuánto tiempo hacia atrás cuenta una propiedad como novedad. Más que el horario sin avisos (8 pm → 8 am) para no perder lo de
// la noche; lo ya avisado se recuerda en property_match_pushes, así que no se repite.
export const EVENT_WINDOW_HOURS = 48;
export const MAX_NAMES = 3;

const HOUR_MS = 3600000;

const num = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const isAvailable = (p) => p.active !== false && (p.status ?? "disponible") === "disponible";

// Igual que alertas-propiedades/index.ts: criterios vacíos = todo.
export function matchesCriteria(p, raw) {
  const c = raw || {};
  const eq = (want, have) => !want || String(want) === String(have ?? "");
  if (!eq(c.type, p.type) || !eq(c.operation_type, p.operation_type) || !eq(c.tipo_nave, p.tipo_nave) || !eq(c.zone, p.zone)) return false;
  const price = Number(p.price) || 0;
  const minPrice = num(c.min_price);
  const maxPrice = num(c.max_price);
  if (minPrice != null && price < minPrice) return false;
  if (maxPrice != null && price > maxPrice) return false;
  const area = Number(p.area_m2) || 0;
  const minArea = num(c.min_area);
  const maxArea = num(c.max_area);
  if (minArea != null && area < minArea) return false;
  if (maxArea != null && area > maxArea) return false;
  const atLeast = (want, have) => {
    const w = num(want);
    return w == null || (Number(have) || 0) >= w;
  };
  if (!atLeast(c.min_bedrooms, p.bedrooms) || !atLeast(c.min_bathrooms, p.bathrooms) || !atLeast(c.min_parking, p.parking)) return false;
  const wanted = Array.isArray(c.amenities) ? c.amenities : [];
  if (wanted.length > 0) {
    const have = new Set(p.amenities || []);
    if (!wanted.every((a) => have.has(a))) return false;
  }
  return true;
}

const inCity = (property, city) => {
  const zone = String(property.zone || "").trim().toLowerCase();
  const c = city.trim().toLowerCase();
  return Boolean(zone) && (zone === c || zone.startsWith(`${c} - `));
};

// Como en el panel: una ciudad también abarca sus colonias; una colonia concreta se compara exacta.
export function matchesProspectCriteria(property, criteria) {
  const { zone, ...rest } = criteria || {};
  if (zone && LAGUNA_CITIES.includes(zone)) return inCity(property, zone) && matchesCriteria(property, rest);
  return matchesCriteria(property, criteria);
}

const hasCriteria = (prospect) => Object.keys(prospect?.search_criteria || {}).length > 0;

// Prospectos abiertos a los que les encaja la propiedad (sin quien ya preguntó por esa misma propiedad).
export function prospectsFor(property, prospects) {
  if (!isAvailable(property)) return [];
  return prospects.filter((p) => OPEN_STAGES.includes(p.stage) && hasCriteria(p) && p.property_id !== property.id && matchesProspectCriteria(property, p.search_criteria));
}

const ageHours = (iso, now) => {
  const time = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(time) ? Infinity : (now - time) / HOUR_MS;
};

// Novedades de las últimas EVENT_WINDOW_HOURS: { kind: "new" | "priceDrop", property, at, percent? }. Igual que freshEvents() del
// panel (una rebaja pesa más que «nueva»), con la ventana en horas.
export function recentEvents(properties, now = Date.now()) {
  const events = [];
  for (const property of properties) {
    if (!isAvailable(property)) continue;
    const previous = Number(property.previous_price);
    const current = Number(property.price);
    if (previous > current && current > 0 && ageHours(property.price_changed_at, now) <= EVENT_WINDOW_HOURS) {
      events.push({ kind: "priceDrop", property, at: property.price_changed_at, percent: Math.round(((previous - current) / previous) * 100) });
    } else if (ageHours(property.created_at, now) <= EVENT_WINDOW_HOURS) {
      events.push({ kind: "new", property, at: property.created_at });
    }
  }
  return events;
}

// Llave de una novedad ya avisada (property_match_pushes: property_id, kind, event_at). Se compara por instante, no por texto: la
// base devuelve las fechas en otro formato que el que se mandó.
export const eventKey = (propertyId, kind, at) => `${propertyId}|${kind}|${new Date(at).getTime()}`;

const money = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "Prospecto";
const clip = (text, max = 150) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function describe(entry) {
  const { property, kind, percent } = entry;
  const where = property.zone ? ` (${property.zone})` : "";
  return `${kind === "priceDrop" ? `Bajó ${percent} %: ` : ""}${String(property.title || "Propiedad").trim()}${where} — ${money(Number(property.price))}`;
}

function namesText(prospects) {
  const names = [...new Set(prospects.map((p) => firstName(p.name)))];
  const shown = names.slice(0, MAX_NAMES).join(", ");
  return names.length > MAX_NAMES ? `${shown} y ${names.length - MAX_NAMES} más` : shown;
}

// `entries`: [{ property, kind, percent, prospects }] de UN destinatario → el texto del push.
export function buildPush(entries, { office = false } = {}) {
  const everyone = entries.flatMap((e) => e.prospects);
  if (entries.length === 1) {
    const [entry] = entries;
    const who = entry.prospects.length === 1 ? firstName(entry.prospects[0].name) : `${entry.prospects.length} prospectos`;
    const title = office
      ? entry.kind === "priceDrop" ? `Bajó de precio y le encaja a ${who} (sin asesor)` : `Propiedad nueva que le encaja a ${who} (sin asesor)`
      : entry.kind === "priceDrop" ? `Bajó de precio y le encaja a ${who}` : `Propiedad nueva que le encaja a ${who}`;
    return { title, body: clip(`${describe(entry)} · ${namesText(entry.prospects)}`), url: office ? "/admin/prospectos" : "/admin/mi-dia" };
  }
  const title = office ? `${entries.length} propiedades le encajan a prospectos sin asesor` : `${entries.length} propiedades le encajan a tus prospectos`;
  return { title, body: clip(`${entries.map((e) => describe(e)).join(" · ")} · ${namesText(everyone)}`), url: office ? "/admin/prospectos" : "/admin/mi-dia" };
}

// Qué avisar ahora. Sin efectos: recibe propiedades, prospectos y lo ya avisado (`sent`: llaves de eventKey).
// → { claims: [{ property_id, kind, event_at }]  — lo que hay que dejar registrado como avisado,
//     pushes: [{ advisorId | null, office, ...{ title, body, url } }]  — uno por asesor y uno para la oficina (sin asesor) }
export function planMatchPushes({ properties, prospects, sent = new Set(), now = Date.now() }) {
  const claims = [];
  const byRecipient = new Map(); // advisor_id | "" (oficina) → entradas
  for (const event of recentEvents(properties, now)) {
    if (sent.has(eventKey(event.property.id, event.kind, event.at))) continue;
    const matched = prospectsFor(event.property, prospects);
    if (matched.length === 0) continue;
    claims.push({ property_id: event.property.id, kind: event.kind, event_at: event.at });
    const groups = new Map();
    for (const p of matched) groups.set(p.advisor_id || "", [...(groups.get(p.advisor_id || "") || []), p]);
    for (const [recipient, list] of groups) {
      byRecipient.set(recipient, [...(byRecipient.get(recipient) || []), { property: event.property, kind: event.kind, percent: event.percent, prospects: list }]);
    }
  }
  const pushes = [...byRecipient.entries()].map(([recipient, entries]) => ({
    advisorId: recipient || null,
    office: !recipient,
    ...buildPush(entries, { office: !recipient }),
  }));
  return { claims, pushes };
}

// Hora en México (0-23): solo se avisa de 8 am a 8 pm.
export function mexicoHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "America/Mexico_City" }).format(now)) % 24;
}
export const isQuietHour = (now = new Date()) => {
  const h = mexicoHour(now);
  return h < 8 || h >= 20;
};

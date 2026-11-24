// Búsqueda por texto libre del listado público ("casa con alberca Senderos").
// Cada palabra debe aparecer en el título, la descripción, la zona, la
// dirección o el código; todas las palabras a la vez (Y), en cualquier orden.
//
// Los acentos no pueden estorbar: quien escribe "torreon" debe encontrar
// "Torreón". En modo demo se compara sin acentos de ambos lados. En Supabase
// (`ilike` distingue acentos) cada palabra se manda también con una vocal
// acentuada a la vez (torreón, torréon…), que cubre el español de a diario sin
// necesitar una extensión de Postgres ni correr SQL nuevo.

export const SEARCH_COLUMNS = ["title", "description", "zone", "address", "code"];
export const SEARCH_MAX_TOKENS = 4;
export const SEARCH_MAX_TOKEN_LENGTH = 30;
const MAX_VARIANTS = 10;

const ACCENTED = { a: "á", e: "é", i: "í", o: "ó", u: "ú", n: "ñ" };

export function stripAccents(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Palabras de la búsqueda, ya limpias de lo que rompería un filtro de
// PostgREST (, ( ) : " \) o actuaría de comodín (% * _).
export function searchTokens(query) {
  return String(query ?? "")
    .replace(/[,():"'\\%*_]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim().slice(0, SEARCH_MAX_TOKEN_LENGTH))
    .filter((token) => token.length >= 2)
    .slice(0, SEARCH_MAX_TOKENS);
}

// La palabra tal cual, sin acentos y con UNA vocal (o la n) acentuada en cada
// posición posible, sin repetir.
export function accentVariants(token) {
  const lower = String(token).toLowerCase();
  const plain = stripAccents(lower);
  const variants = new Set([lower, plain]);
  for (let i = 0; i < plain.length && variants.size < MAX_VARIANTS; i += 1) {
    const accented = ACCENTED[plain[i]];
    if (accented) variants.add(plain.slice(0, i) + accented + plain.slice(i + 1));
  }
  return [...variants].slice(0, MAX_VARIANTS);
}

// Un filtro `or` de PostgREST por palabra (varios `.or()` seguidos se
// combinan con Y): la palabra, en cualquiera de sus variantes, en cualquiera
// de las columnas.
export function supabaseSearchFilters(query) {
  return searchTokens(query).map((token) =>
    accentVariants(token)
      .flatMap((variant) => SEARCH_COLUMNS.map((column) => `${column}.ilike.%${variant}%`))
      .join(",")
  );
}

// Espejo en modo demo: sin acentos ni mayúsculas, todas las palabras.
export function matchesSearch(property, query) {
  const tokens = searchTokens(query).map(stripAccents);
  if (tokens.length === 0) return true;
  const haystack = stripAccents(SEARCH_COLUMNS.map((column) => property[column] ?? "").join(" \n "));
  return tokens.every((token) => haystack.includes(token));
}

// Zona del mapa ("buscar en esta zona"): { south, west, north, east }.
export function isValidBounds(bounds) {
  if (!bounds) return false;
  const { south, west, north, east } = bounds;
  return [south, west, north, east].every(Number.isFinite) && south < north && west < east;
}

export function matchesBounds(property, bounds) {
  if (!isValidBounds(bounds)) return true;
  const lat = Number(property.lat);
  const lng = Number(property.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
}

const round5 = (n) => Math.round(n * 1e5) / 1e5;

// En la dirección del navegador: "sur,oeste,norte,este".
export function boundsToParam(bounds) {
  if (!isValidBounds(bounds)) return "";
  return [bounds.south, bounds.west, bounds.north, bounds.east].map(round5).join(",");
}

export function boundsFromParam(param) {
  if (!param) return null;
  const parts = String(param).split(",").map(Number);
  if (parts.length !== 4) return null;
  const [south, west, north, east] = parts;
  const bounds = { south, west, north, east };
  return isValidBounds(bounds) ? bounds : null;
}

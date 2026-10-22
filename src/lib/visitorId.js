const STORAGE_KEY = "acl_visitor_id";

// Id aleatorio y anónimo (no es una cuenta ni un dato personal) que vive en
// este navegador — sirve para no contar dos veces a la misma persona el
// mismo día en "vistas recientes" (recargar la página no debe inflar el
// conteo).
// Se usa como parámetro `uuid` en record_property_view (Supabase), así que
// el respaldo sin crypto.randomUUID también debe tener forma de UUID v4
// válido (navegadores muy viejos no lo soportan, pero sí Date.now()/Math.random()).
export function generateVisitorId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (c) => (c === "x" ? hex() : ((Math.random() * 4) | 8).toString(16)));
}

export function getOrCreateVisitorId() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = generateVisitorId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return generateVisitorId();
  }
}

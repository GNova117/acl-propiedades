// 364: la calculadora de valor y «Vende tu casa» preguntan lo mismo («¿cuánto vale?») y ahora usan la MISMA fórmula (sellEstimate).
// Para que quien ya usó la calculadora no tenga que volver a teclear, el botón «Pedir estimación formal» lleva sus datos en la
// dirección (?tipo=…&zona=…&terreno=…&construccion=…) y «Vende tu casa» los pone en el formulario. Funciones puras; todo lo que
// viene de la dirección se limpia (la gente puede editarla a mano).
const KEYS = { type: "tipo", zoneId: "zona", landArea: "terreno", builtArea: "construccion" };
const IDENT = /^[a-z0-9_-]{1,60}$/i;
const MAX_AREA = 1_000_000;

const cleanArea = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_AREA ? String(Math.round(n * 100) / 100) : "";
};

// → «tipo=casa&zona=zone-torreon&terreno=200&construccion=120» (sin los datos vacíos o inválidos)
export function sellPrefillQuery({ type, zoneId, landArea, builtArea } = {}) {
  const params = new URLSearchParams();
  if (type && IDENT.test(String(type))) params.set(KEYS.type, String(type));
  if (zoneId && IDENT.test(String(zoneId))) params.set(KEYS.zoneId, String(zoneId));
  const land = cleanArea(landArea);
  const built = cleanArea(builtArea);
  if (land) params.set(KEYS.landArea, land);
  if (built) params.set(KEYS.builtArea, built);
  return params.toString();
}

// `params`: URLSearchParams (o cualquier cosa con .get). → solo los campos válidos, con los nombres del formulario.
export function readSellPrefill(params) {
  const out = {};
  if (!params || typeof params.get !== "function") return out;
  const type = params.get(KEYS.type);
  const zone = params.get(KEYS.zoneId);
  if (type && IDENT.test(type)) out.type = type;
  if (zone && IDENT.test(zone)) out.zoneId = zone;
  const land = cleanArea(params.get(KEYS.landArea));
  const built = cleanArea(params.get(KEYS.builtArea));
  if (land) out.landArea = land;
  if (built) out.builtArea = built;
  return out;
}

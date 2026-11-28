// Nombres editables de los tipos de propiedad (property_types.label).
//
// El sitio muestra los tipos con propertyTypeLabel(t, key) (format.js), que
// lee la traducción `propertyType.<key>` — y se llama desde ~20 lugares. En vez
// de tocarlos todos, el nombre guardado en la base se inyecta en esas mismas
// traducciones al arrancar y cada vez que el admin renombra un tipo
// (react-i18next re-renderiza solo: ver `bindI18nStore` en src/i18n/index.js).
//
// - Tipo de fábrica sin renombrar (su nombre coincide, sin importar mayúsculas
//   ni acentos, con la traducción ES original): se deja la traducción tal cual,
//   para no perder el inglés ("House"/"Apartment"…).
// - Tipo renombrado, o agregado por el admin: el nombre guardado se usa tal cual
//   en ambos idiomas (con sus acentos — antes se perdían al humanizar la clave).
import i18n from "../i18n";
import es from "../i18n/locales/es.json";
import { slugify } from "./format";

// Copia de los textos de fábrica tomada al cargar este módulo, antes de inyectar
// nada: i18next guarda por referencia los mismos objetos JSON importados arriba
// y addResourceBundle los MUTA, así que sin la copia el "original" quedaría
// pisado por el primer nombre editado y ya no habría a qué restaurar.
// El inglés de fábrica va aquí (no se importa en.json: ese archivo se baja solo cuando se pide el idioma; una prueba cuida que coincida).
export const FACTORY_EN = {
  casa: "House",
  departamento: "Apartment",
  nave_industrial: "Industrial Warehouse",
  terreno: "Land",
  local_comercial: "Commercial Space",
};
const FACTORY = { es: { ...es.propertyType }, en: { ...FACTORY_EN } };

export function applyPropertyTypeLabels(types) {
  const overrides = { es: {}, en: {} };
  for (const { key, label } of types || []) {
    const name = String(label || "").trim();
    if (!name) continue;
    const factoryEs = FACTORY.es[key];
    if (factoryEs !== undefined && slugify(name) === slugify(factoryEs)) {
      // Sin renombrar: se restaura la traducción original (por si venía de un
      // nombre personalizado anterior que ya se había aplicado).
      overrides.es[key] = factoryEs;
      overrides.en[key] = FACTORY.en[key] ?? factoryEs;
    } else {
      overrides.es[key] = name;
      overrides.en[key] = name;
    }
  }
  for (const lng of ["es", "en"]) {
    i18n.addResourceBundle(lng, "translation", { propertyType: overrides[lng] }, true, true);
  }
}

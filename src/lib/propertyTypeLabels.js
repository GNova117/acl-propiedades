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
//
// El inglés ya no está en el paquete inicial (se baja bajo demanda, ver
// src/i18n/index.js): sus nombres solo se inyectan cuando ese bundle ya está en
// i18next, y se reaplican en cuanto termina de bajar.
import i18n, { getEnglishFactory, onEnglishLoaded } from "../i18n";
import es from "../i18n/locales/es.json";
import { slugify } from "./format";

// Copia de los textos de fábrica tomada al cargar este módulo, antes de inyectar
// nada: i18next guarda por referencia los mismos objetos JSON importados arriba
// y addResourceBundle los MUTA, así que sin la copia el "original" quedaría
// pisado por el primer nombre editado y ya no habría a qué restaurar.
// (La copia en inglés la toma src/i18n/index.js al bajar el bundle: getEnglishFactory.)
const FACTORY_ES = { ...es.propertyType };

let latestTypes = [];

function inject(lng, types, factory) {
  const overrides = {};
  for (const { key, label } of types) {
    const name = String(label || "").trim();
    if (!name) continue;
    const factoryEs = FACTORY_ES[key];
    if (factoryEs !== undefined && slugify(name) === slugify(factoryEs)) {
      // Sin renombrar: se restaura la traducción original (por si venía de un
      // nombre personalizado anterior que ya se había aplicado).
      overrides[key] = lng === "es" ? factoryEs : (factory[key] ?? factoryEs);
    } else {
      overrides[key] = name;
    }
  }
  i18n.addResourceBundle(lng, "translation", { propertyType: overrides }, true, true);
}

function applyEnglish() {
  const factory = getEnglishFactory();
  if (factory) inject("en", latestTypes, factory.propertyType);
}

// El bundle en inglés puede llegar después de que se aplicaron los tipos: se reaplican entonces.
onEnglishLoaded(applyEnglish);

export function applyPropertyTypeLabels(types) {
  latestTypes = types || [];
  inject("es", latestTypes, FACTORY_ES);
  applyEnglish();
}

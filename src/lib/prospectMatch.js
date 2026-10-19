// Cruce prospectos ↔ propiedades: el "qué busca" estructurado del prospecto
// (prospectos.search_criteria, mismo formato que las alertas del sitio) contra
// las propiedades disponibles, usando la misma coincidencia que las alertas
// (alertMatch.matchesCriteria). Funciones puras; la pantalla de Prospectos las
// usa para mostrar "qué propiedades le encajan" y la de Propiedades para "a qué
// prospectos avisarles".

import { describeCriteria, isAvailable, matchesCriteria } from "./alertMatch";
import { formatMXN, propertyTypeLabel } from "./format";
import { OPEN_STAGES, isOpenStage } from "./prospects";
import { propertyMatchesCity } from "./zoneLandingPages";
import { LAGUNA_CITIES } from "./zones";

export const hasCriteria = (prospect) => Object.keys(prospect?.search_criteria || {}).length > 0;

// Igual que alertMatch.matchesCriteria, salvo la zona: quien busca en una ciudad
// ("Torreón") quiere ver también las colonias de esa ciudad ("Torreón - Las
// Villas"); una colonia concreta sí se compara exacta. matchesCriteria se deja
// intacto porque la función de envío de alertas tiene su propia copia.
function matches(property, criteria) {
  const { zone, ...rest } = criteria;
  if (zone && LAGUNA_CITIES.includes(zone)) return propertyMatchesCity(property, zone) && matchesCriteria(property, rest);
  return matchesCriteria(property, criteria);
}

// Propiedades disponibles que encajan con lo que busca un prospecto abierto,
// las más nuevas primero. No incluye la propiedad por la que ya preguntó.
export function matchingProperties(prospect, properties) {
  if (!isOpenStage(prospect.stage) || !hasCriteria(prospect)) return [];
  return properties
    .filter((p) => isAvailable(p) && p.id !== prospect.property_id && matches(p, prospect.search_criteria))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

// Prospectos abiertos a los que les encaja una propiedad disponible, los más
// avanzados en el embudo primero (negociación antes que nuevo). No incluye a
// quien ya preguntó por esa misma propiedad.
export function matchingProspects(property, prospects) {
  if (!isAvailable(property)) return [];
  return prospects
    .filter((p) => isOpenStage(p.stage) && hasCriteria(p) && p.property_id !== property.id && matches(property, p.search_criteria))
    .sort((a, b) => OPEN_STAGES.indexOf(b.stage) - OPEN_STAGES.indexOf(a.stage) || String(a.name || "").localeCompare(String(b.name || "")));
}

// Texto corto de lo que busca ("Tipo: Casa · Zona: Lerdo · Precio: ≤ $1,800,000"),
// con las mismas etiquetas que las alertas.
export function criteriaSummary(criteria, t) {
  return describeCriteria(criteria, { money: formatMXN })
    .map(({ key, value }) => {
      const shown = key === "type" ? propertyTypeLabel(t, value) : key === "operation" ? t(`propertyOperation.${value}`) : value;
      return `${t(`alerts.criteria.${key}`)}: ${shown}`;
    })
    .join(" · ");
}

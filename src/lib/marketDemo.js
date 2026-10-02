// Datos de EJEMPLO para el modo demo (sin Supabase): ahí no existe la función
// api/market-comps ni hay llave de Claude, así que esta consulta se inventa de
// forma determinista a partir del nombre de la zona. Cada anuncio apunta a
// ejemplo.invalid (dominio reservado que nunca resuelve) y la consulta lleva
// `usage.demo = true`, para que la pantalla lo etiquete y nadie lo confunda
// con precios reales.
import { basisFor, normalizeComp, summarizeMarket } from "./marketStats";

// PRNG pequeño y repetible: la misma zona da siempre los mismos anuncios.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hashString = (s) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);

// Precio base por m² según el tipo; la zona lo mueve ±25%.
const BASE_PPM = { casa: 17_000, departamento: 21_000, terreno: 3_800 };
const NEIGHBORS = ["Vecina Norte", "Vecina Sur", "Vecina Oriente"];

export function buildDemoSnapshot({ zone, municipality, propertyType, builtArea }) {
  const basis = basisFor(propertyType);
  const rand = mulberry32(hashString(`${zone}|${municipality}|${propertyType}`));
  const zoneFactor = 0.75 + rand() * 0.5;
  const base = BASE_PPM[propertyType] * zoneFactor;
  const targetBuilt = builtArea > 0 ? builtArea : propertyType === "departamento" ? 85 : 140;

  const raws = Array.from({ length: 15 }, (_, i) => {
    const built = Math.round(targetBuilt * (0.6 + rand() * 0.9));
    const land = propertyType === "departamento" ? null : Math.round(built * (1 + rand() * 0.8));
    const ppm = base * (0.82 + rand() * 0.36);
    const area = basis === "land" ? land || built : built;
    const exactZone = i < 10;
    return {
      title: `${propertyType === "terreno" ? "Terreno" : propertyType === "departamento" ? "Departamento" : "Casa"} en venta en ${exactZone ? zone : NEIGHBORS[i % NEIGHBORS.length]}`,
      price: Math.round((ppm * area) / 5000) * 5000,
      builtArea: propertyType === "terreno" ? null : built,
      landArea: propertyType === "terreno" ? land || built : land,
      bedrooms: propertyType === "terreno" ? null : 2 + Math.floor(rand() * 3),
      colonia: exactZone ? zone : `${NEIGHBORS[i % NEIGHBORS.length]} de ${zone}`,
      exactZone,
      url: `https://ejemplo.invalid/anuncio/${hashString(zone) % 1000}-${i + 1}`,
    };
  });
  // Un anuncio claramente fuera de mercado para que se vea el filtro de atípicos.
  const outlierArea = basis === "land" ? raws[0].landArea : raws[0].builtArea;
  raws.push({ ...raws[0], title: `${raws[0].title} (precio atípico)`, price: Math.round((base * 2.4 * outlierArea) / 5000) * 5000, url: "https://ejemplo.invalid/anuncio/atipico" });

  const comps = raws.map((raw) => normalizeComp(raw, { basis })).filter(Boolean);
  const summary = summarizeMarket(comps, basis);

  return {
    created_by: "demo",
    zone_name: zone,
    municipality,
    property_type: propertyType,
    basis,
    comps,
    summary: { total: summary.total, used: summary.used, outliers: summary.outliers, ppm: summary.ppm, medianPrice: summary.medianPrice },
    notes: "Datos de ejemplo del modo demo: no vienen de internet.",
    usage: { demo: true, model: "demo", input: 0, output: 0, searches: 0, costUsd: 0, discarded: 0, failedAngles: 0 },
  };
}

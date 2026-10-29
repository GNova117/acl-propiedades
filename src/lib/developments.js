// Desarrollos (torres): un edificio con muchos departamentos que se vende como
// un solo proyecto. Las fotos viven en la torre y en cada modelo (tipología),
// no en cada departamento: un departamento solo trae número, piso, modelo,
// precio y estatus. Todo son funciones puras para poder probarlas sin DOM.

export const UNIT_STATUSES = ["disponible", "apartada", "vendida"];
export const DEVELOPMENT_STAGES = ["preventa", "construccion", "entrega_inmediata"];

const STATUS_ALIASES = {
  disponible: "disponible",
  disponibles: "disponible",
  libre: "disponible",
  apartada: "apartada",
  apartado: "apartada",
  reservada: "apartada",
  reservado: "apartada",
  vendida: "vendida",
  vendido: "vendida",
};

const stripAccents = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const norm = (text) => stripAccents(text).trim().toLowerCase();

export function normalizeUnitStatus(value) {
  return STATUS_ALIASES[norm(value)] || null;
}

// "$1,850,000.00" / "1.850.000" no se soportan a propósito (ambiguo); se
// aceptan comas como separador de miles, que es lo que exporta Excel en México.
export function parsePrice(value) {
  const cleaned = String(value ?? "").replace(/[$\s,]/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const number = Number(cleaned);
  return number > 0 ? number : null;
}

const HEADER_ALIASES = {
  numero: "number",
  num: "number",
  depto: "number",
  departamento: "number",
  unidad: "number",
  piso: "floor",
  nivel: "floor",
  modelo: "model",
  tipo: "model",
  tipologia: "model",
  precio: "price",
  estatus: "status",
  estado: "status",
  vista: "view",
  orientacion: "view",
};

const DEFAULT_COLUMNS = ["number", "floor", "model", "price", "status", "view"];

function splitLine(line) {
  const delimiter = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  // Con coma como delimitador, los precios con coma ("1,850,000") van entre
  // comillas, que es como los exporta Excel.
  if (delimiter === ",") {
    const cells = [];
    let current = "";
    let quoted = false;
    for (const char of line) {
      if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) {
        cells.push(current);
        current = "";
      } else current += char;
    }
    cells.push(current);
    return cells.map((cell) => cell.trim());
  }
  return line.split(delimiter).map((cell) => cell.trim());
}

// Convierte texto pegado desde Excel/CSV en departamentos. Primera fila con
// encabezados (número, piso, modelo, precio, estatus, vista) o, sin ellos, ese
// mismo orden de columnas. Devuelve las filas buenas y la lista de errores
// por fila (con su número de línea) para que el admin corrija sin adivinar.
export function parseUnitsCsv(text, models = []) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const units = [];
  const errors = [];
  if (lines.length === 0) return { units, errors };

  let columns = DEFAULT_COLUMNS;
  let firstDataLine = 0;
  const firstCells = splitLine(lines[0]).map((cell) => HEADER_ALIASES[norm(cell)] || null);
  if (firstCells.filter(Boolean).length >= 2) {
    columns = firstCells;
    firstDataLine = 1;
  }

  const modelKeys = new Map();
  for (const model of models) {
    modelKeys.set(norm(model.key), model.key);
    modelKeys.set(norm(model.name), model.key);
  }
  const seen = new Set();

  for (let i = firstDataLine; i < lines.length; i += 1) {
    const lineNumber = i + 1;
    const cells = splitLine(lines[i]);
    const row = {};
    columns.forEach((column, index) => {
      if (column) row[column] = cells[index] ?? "";
    });

    const number = String(row.number ?? "").trim();
    if (!number) {
      errors.push({ line: lineNumber, message: "Falta el número de departamento." });
      continue;
    }
    if (seen.has(norm(number))) {
      errors.push({ line: lineNumber, message: `El departamento ${number} está repetido.` });
      continue;
    }
    const floor = Number.parseInt(row.floor, 10);
    if (!Number.isInteger(floor)) {
      errors.push({ line: lineNumber, message: `Departamento ${number}: el piso no es un número.` });
      continue;
    }
    const model = modelKeys.get(norm(row.model));
    if (!model) {
      errors.push({ line: lineNumber, message: `Departamento ${number}: el modelo "${row.model ?? ""}" no existe.` });
      continue;
    }
    const price = parsePrice(row.price);
    if (price == null) {
      errors.push({ line: lineNumber, message: `Departamento ${number}: el precio no es válido.` });
      continue;
    }
    const status = row.status ? normalizeUnitStatus(row.status) : "disponible";
    if (!status) {
      errors.push({ line: lineNumber, message: `Departamento ${number}: el estatus "${row.status}" no existe.` });
      continue;
    }
    seen.add(norm(number));
    units.push({ number, floor, model, price, status, view: String(row.view ?? "").trim() });
  }
  return { units, errors };
}

export function unitsToCsv(units, models = []) {
  const modelName = new Map(models.map((m) => [m.key, m.name]));
  const header = "numero,piso,modelo,precio,estatus,vista";
  const rows = units.map((u) =>
    [u.number, u.floor, modelName.get(u.model) || u.model, u.price, u.status, u.view || ""]
      .map((cell) => (String(cell).includes(",") ? `"${cell}"` : cell))
      .join(",")
  );
  return [header, ...rows].join("\n");
}

// Departamento + los datos de su modelo (m², recámaras, fotos…). El modelo
// manda en todo lo físico; el departamento solo pone lo que lo distingue.
export function resolveUnit(development, unit) {
  const model = (development.models || []).find((m) => m.key === unit.model) || null;
  return {
    ...unit,
    model_name: model?.name || unit.model,
    area_m2: model?.area_m2 ?? null,
    bedrooms: model?.bedrooms ?? null,
    bathrooms: model?.bathrooms ?? null,
    parking: model?.parking ?? null,
    images: model?.images || [],
    plan_image: model?.plan_image || "",
    // Para estimateMonthlyPayment, que espera la forma de una propiedad.
    type: "departamento",
  };
}

export function developmentStats(development) {
  const units = development.units || [];
  const models = development.models || [];
  const available = units.filter((u) => u.status === "disponible");
  const prices = available.map((u) => u.price);
  const usedModels = models.filter((m) => units.some((u) => u.model === m.key));
  const areas = usedModels.map((m) => Number(m.area_m2)).filter((n) => n > 0);
  const bedrooms = usedModels.map((m) => m.bedrooms).filter((n) => n != null).map(Number);
  const floors = units.map((u) => u.floor);
  return {
    total: units.length,
    available: available.length,
    reserved: units.filter((u) => u.status === "apartada").length,
    sold: units.filter((u) => u.status === "vendida").length,
    fromPrice: prices.length ? Math.min(...prices) : null,
    toPrice: prices.length ? Math.max(...prices) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    minBedrooms: bedrooms.length ? Math.min(...bedrooms) : null,
    maxBedrooms: bedrooms.length ? Math.max(...bedrooms) : null,
    floors: floors.length ? Math.max(...floors) : 0,
  };
}

// Por modelo: cuántos quedan y desde cuánto — para las tarjetas de modelos.
export function modelStats(development) {
  return (development.models || []).map((model) => {
    const units = (development.units || []).filter((u) => u.model === model.key);
    const available = units.filter((u) => u.status === "disponible");
    return {
      model,
      total: units.length,
      available: available.length,
      fromPrice: available.length ? Math.min(...available.map((u) => u.price)) : null,
    };
  });
}

// Pisos de arriba hacia abajo, como se ve el edificio; dentro de cada piso,
// los departamentos por número.
export function groupUnitsByFloor(units) {
  const byFloor = new Map();
  for (const unit of units) {
    if (!byFloor.has(unit.floor)) byFloor.set(unit.floor, []);
    byFloor.get(unit.floor).push(unit);
  }
  return [...byFloor.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([floor, list]) => ({
      floor,
      units: list.slice().sort((a, b) => String(a.number).localeCompare(String(b.number), "es", { numeric: true })),
    }));
}

export const EMPTY_UNIT_FILTERS = { model: "", bedrooms: "", status: "disponible", floorFrom: "", maxPrice: "", sortBy: "floor_desc" };

const UNIT_SORTERS = {
  floor_desc: (a, b) => b.floor - a.floor || String(a.number).localeCompare(String(b.number), "es", { numeric: true }),
  floor_asc: (a, b) => a.floor - b.floor || String(a.number).localeCompare(String(b.number), "es", { numeric: true }),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
};

export function filterUnits(development, filters = EMPTY_UNIT_FILTERS) {
  const resolved = (development.units || []).map((unit) => resolveUnit(development, unit));
  const sorter = UNIT_SORTERS[filters.sortBy] || UNIT_SORTERS.floor_desc;
  return resolved
    .filter((u) => !filters.model || u.model === filters.model)
    .filter((u) => !filters.status || u.status === filters.status)
    .filter((u) => filters.bedrooms === "" || filters.bedrooms == null || (u.bedrooms ?? -Infinity) >= Number(filters.bedrooms))
    .filter((u) => filters.floorFrom === "" || filters.floorFrom == null || u.floor >= Number(filters.floorFrom))
    .filter((u) => !filters.maxPrice || u.price <= Number(filters.maxPrice))
    .sort(sorter);
}

export function unitLabel(development, unit) {
  return `${development.name} · Depto. ${unit.number}`;
}

// Mensaje de WhatsApp ya escrito: menciona la torre, el depto y el modelo para
// que quien conteste sepa de qué se trata sin preguntar. `url` es opcional.
export function unitWhatsappText(development, unit, url) {
  const lines = [`Hola, me interesa el departamento ${unit.number} (piso ${unit.floor}, modelo ${unit.model_name || unit.model}) de ${development.name}.`];
  if (url) lines.push(url);
  return lines.join("\n");
}

export function developmentWhatsappText(development, url) {
  const lines = [`Hola, quiero información de los departamentos de ${development.name}.`];
  if (url) lines.push(url);
  return lines.join("\n");
}

// Validación del formulario del admin: devuelve un objeto campo → mensaje
// (vacío si todo está bien). Los textos son llaves de i18n.
export function validateDevelopment(data) {
  const errors = {};
  if (!String(data.name ?? "").trim()) errors.name = "required";
  if (!String(data.developer_name ?? "").trim()) errors.developer_name = "required";
  if (!String(data.zone ?? "").trim()) errors.zone = "required";
  const keys = new Set();
  for (const model of data.models || []) {
    if (!String(model.name ?? "").trim() || !String(model.key ?? "").trim()) {
      errors.models = "modelIncomplete";
      break;
    }
    if (keys.has(model.key)) {
      errors.models = "modelDuplicate";
      break;
    }
    keys.add(model.key);
  }
  const unitModelMissing = (data.units || []).some((u) => !keys.has(u.model));
  if (unitModelMissing) errors.units = "unitModelMissing";
  return errors;
}

// Slug de URL con guiones ("Torre Aurora" → "torre-aurora"). No usa slugify()
// de format.js porque ese separa con guion bajo (es para llaves, no URLs).
export function developmentSlug(name) {
  return (
    stripAccents(name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "desarrollo"
  );
}

// Llave técnica de un modelo a partir de su nombre ("Modelo B" → "modelo-b").
export function modelKeyFromName(name) {
  return developmentSlug(name);
}

// Sube las fotos nuevas del formulario y las junta con las que ya existían.
// `upload(files)` lo pone cada backend (data URLs en modo demo, Storage en
// Supabase) y devuelve las URLs en el mismo orden; así la lógica de qué foto
// va dónde vive aquí una sola vez.
export async function resolveDevelopmentMedia(data, upload) {
  const one = async (file, existing) => (file ? (await upload([file]))[0] : existing || "");
  const hero_image = await one(data.heroFile, data.existingHero);
  const developer_logo = await one(data.logoFile, data.existingLogo);
  const images = [...(data.existingImages || []), ...(await upload(data.imageFiles || []))];
  const models = {};
  for (const model of data.models || []) {
    models[model.key] = {
      images: [...(model.existingImages || []), ...(await upload(model.imageFiles || []))],
      plan_image: await one(model.planFile, model.existingPlan),
    };
  }
  return { hero_image: hero_image || images[0] || "", developer_logo, images, models };
}

const numOrNull = (value) => (value === "" || value == null || Number.isNaN(Number(value)) ? null : Number(value));

// Lo que se guarda en la tabla/almacén: textos recortados, números como
// números y las fotos ya resueltas. Sin slug ni id — eso lo pone el backend.
export function buildDevelopmentPayload(data, media) {
  return {
    name: data.name.trim(),
    tagline: data.tagline?.trim() || null,
    description: data.description?.trim() || null,
    zone: data.zone.trim(),
    address: data.address?.trim() || null,
    lat: numOrNull(data.lat),
    lng: numOrNull(data.lng),
    stage: DEVELOPMENT_STAGES.includes(data.stage) ? data.stage : "preventa",
    delivery_date: data.delivery_date?.trim() || null,
    developer_name: data.developer_name.trim(),
    developer_logo: media.developer_logo || null,
    hero_image: media.hero_image || null,
    images: media.images,
    amenities: (data.amenities || []).map((a) => String(a).trim()).filter(Boolean),
    models: (data.models || []).map((model) => ({
      key: model.key,
      name: model.name.trim(),
      area_m2: numOrNull(model.area_m2),
      bedrooms: numOrNull(model.bedrooms),
      bathrooms: numOrNull(model.bathrooms),
      parking: numOrNull(model.parking),
      description: model.description?.trim() || null,
      images: media.models[model.key]?.images || [],
      plan_image: media.models[model.key]?.plan_image || null,
    })),
    units: (data.units || []).map((u) => ({
      number: String(u.number),
      floor: Number(u.floor),
      model: u.model,
      price: Number(u.price),
      status: u.status,
      view: u.view || "",
    })),
    disclaimer: data.disclaimer?.trim() || null,
    published: Boolean(data.published),
  };
}

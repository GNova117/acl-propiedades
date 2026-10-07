import { ZONES, ADVISORS, PROPERTIES, VENTAS_SEED, VISITS_SEED, PROPERTY_TYPES_SEED, AMENITIES_SEED, DEMO_ADMIN, ADMIN_ROLES_SEED, ADMIN_ACCESS_SEED } from "./seedData";
import { generateReportToken, REPORT_TOKEN_PATTERN } from "./visitReport";
import { generatePortalToken, PORTAL_TOKEN_PATTERN, PORTAL_TOKEN_TTL_DAYS } from "./clientPortal";
import { PERFILAMIENTO_VENDEDOR_LIST_FIELDS } from "./perfilamientoVendedor";
import { PERFILAMIENTO_COMPRADOR_LIST_FIELDS } from "./perfilamientoComprador";
import { slugify, numOrNull } from "./format";
import { CLIENT_EXPEDIENTE_KEYS } from "./clientExpedienteFields";
import { compressImageFile, compressImageFiles } from "./imageCompression";
import { buildDemoSnapshot } from "./marketDemo";

function clientExpedientePayload(data) {
  return Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, data[key] || null]));
}

const KEYS = {
  properties: "acl_local_properties",
  advisors: "acl_local_advisors",
  zones: "acl_local_zones",
  propertyTypes: "acl_local_property_types",
  session: "acl_local_session",
  clients: "acl_local_clients",
  clientDocuments: "acl_local_client_documents",
  clientLinks: "acl_local_client_links",
  remodelProjects: "acl_local_remodel_projects",
  remodelProgress: "acl_local_remodel_progress",
  materialsCatalog: "acl_local_materials_catalog",
  laborCatalog: "acl_local_labor_catalog",
  perfilamientosVendedor: "acl_local_perfilamientos",
  perfilamientosComprador: "acl_local_perfilamientos_comprador",
  liquidaciones: "acl_local_liquidaciones",
  ventas: "acl_local_ventas",
  propertyLog: "acl_local_property_log",
  propertyBudgets: "acl_local_property_budgets",
  visits: "acl_local_visits",
  inspections: "acl_local_inspections",
  expenseConcepts: "acl_local_expense_concepts",
  expenseReports: "acl_local_expense_reports",
  keyLog: "acl_local_key_log",
  docLog: "acl_local_doc_log",
  valuations: "acl_local_valuation_estimates",
  marketSnapshots: "acl_local_market_snapshots",
  prospects: "acl_local_prospectos",
  signing: "acl_local_signing_requests",
  prospectStages: "acl_local_prospect_stages",
  alerts: "acl_local_property_alerts",
  reportLinks: "acl_local_report_links",
  adminRoles: "acl_local_admin_roles",
  adminAccess: "acl_local_admin_access",
  agendaCitas: "acl_local_agenda_citas",
  agendaExpedientes: "acl_local_agenda_expedientes",
  amenities: "acl_local_amenities",
  propertyCodeSeq: "acl_local_property_code_seq",
  messages: "acl_local_messages",
  testimonials: "acl_local_testimonials",
  propertyChanges: "acl_local_property_changes",
  blogPosts: "acl_local_blog_posts",
  clientPortalTokens: "acl_local_client_portal_tokens",
  documentAccessLog: "acl_local_document_access_log",
  privacyConsents: "acl_local_privacy_consents",
};

// Un par de artículos de muestra para que /blog no se vea vacío en modo
// demo — en Supabase blog_posts arranca sin filas, el staff lo llena desde
// /admin/blog.
const BLOG_POSTS_SEED = [
  {
    id: "blog-demo-1",
    title: "Guía para comprar casa por primera vez en La Comarca Lagunera",
    slug: "guia-comprar-casa-primera-vez-comarca-lagunera",
    excerpt: "Los pasos, documentos y errores comunes a la hora de comprar tu primera casa en Torreón, Gómez Palacio o Lerdo.",
    body: "Comprar tu primera casa puede parecer complicado, pero con la guía correcta el proceso es mucho más sencillo...\n\n1. Define tu presupuesto real, incluyendo gastos notariales y de escrituración.\n2. Revisa tu historial crediticio si piensas usar un crédito INFONAVIT o bancario.\n3. Visita varias propiedades antes de decidir.\n4. Pide siempre el estado legal del inmueble (libre de gravamen).\n\nEn ACL Propiedades te acompañamos en cada paso.",
    cover_image: null,
    published: true,
    published_at: "2026-09-15T12:00:00.000Z",
    created_at: "2026-09-15T12:00:00.000Z",
    updated_at: "2026-09-15T12:00:00.000Z",
  },
  {
    id: "blog-demo-2",
    title: "¿Vale la pena invertir en una nave industrial en Torreón?",
    slug: "vale-la-pena-invertir-nave-industrial-torreon",
    excerpt: "La Comarca Lagunera se ha vuelto un polo logístico importante. Qué revisar antes de invertir en una nave industrial.",
    body: "La ubicación estratégica de Torreón y Gómez Palacio, junto con el crecimiento del sector logístico, ha hecho que las naves industriales sean una de las inversiones más buscadas en la región...\n\nAlgunos puntos clave: acceso a carreteras principales, altura libre, capacidad eléctrica y zonificación industrial vigente.",
    cover_image: null,
    published: true,
    published_at: "2026-09-22T12:00:00.000Z",
    created_at: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T12:00:00.000Z",
  },
];

function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(fallback));
      return structuredClone(fallback);
    }
    return JSON.parse(raw);
  } catch {
    return structuredClone(fallback);
  }
}

function writeStore(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

// Los videos de propiedad, guardados como data: URL en localStorage (igual
// que las fotos), pueden fácilmente superar el límite de almacenamiento del
// navegador (unos 5-10 MB por origen, muy por debajo de lo que pesa un
// video real) — a diferencia de Supabase Storage, que sí puede con eso. Si
// el guardado falla por cuota, se avisa con un mensaje claro en vez de
// dejar pasar el DOMException genérico del navegador.
const VIDEO_QUOTA_MESSAGE =
  "No se pudo guardar: el video es demasiado grande para el almacenamiento del navegador en modo demo. Prueba con un archivo más corto/ligero, o usa esta función con Supabase conectado (ahí no aplica este límite).";
const FILE_QUOTA_MESSAGE =
  "No se pudo guardar: el archivo es demasiado grande para el almacenamiento del navegador en modo demo. Prueba con uno más ligero, o usa esta función con Supabase conectado (ahí no aplica este límite).";

function writeStoreOrThrowFriendly(key, value, quotaMessage = VIDEO_QUOTA_MESSAGE) {
  try {
    writeStore(key, value);
  } catch (err) {
    if (err.name === "QuotaExceededError") throw new Error(quotaMessage);
    throw err;
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Arranca después de los 9 códigos sembrados (ACL-1001..1009) — mismo
// esquema que la secuencia de Postgres (properties_code_seq start 1001),
// solo que aquí no hay trigger de base de datos que lo haga solo.
function nextPropertyCode() {
  const current = Number(window.localStorage.getItem(KEYS.propertyCodeSeq) || "1009");
  const next = current + 1;
  window.localStorage.setItem(KEYS.propertyCodeSeq, String(next));
  return `ACL-${next}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function filesToDataUrls(files) {
  if (!files || files.length === 0) return [];
  return Promise.all(Array.from(files).map(fileToDataUrl));
}

function withAdvisors(property, advisors) {
  const assigned = advisors.filter((a) => (property.advisor_ids || []).includes(a.id));
  return { ...property, advisors: assigned };
}

function matchesFilters(property, filters = {}) {
  if (filters.activeOnly && !property.active) return false;
  if (filters.type && property.type !== filters.type) return false;
  else if (!filters.type && filters.types && !filters.types.includes(property.type)) return false;
  if (filters.operation_type && property.operation_type !== filters.operation_type) return false;
  if (filters.tipo_nave && property.tipo_nave !== filters.tipo_nave) return false;
  if (filters.zone && property.zone !== filters.zone) return false;
  if (filters.minPrice != null && property.price < filters.minPrice) return false;
  if (filters.maxPrice != null && property.price > filters.maxPrice) return false;
  if (filters.minArea != null && property.area_m2 < filters.minArea) return false;
  if (filters.maxArea != null && property.area_m2 > filters.maxArea) return false;
  if (filters.minBedrooms != null && (property.bedrooms ?? -Infinity) < filters.minBedrooms) return false;
  if (filters.minBathrooms != null && (property.bathrooms ?? -Infinity) < filters.minBathrooms) return false;
  if (filters.minParking != null && (property.parking ?? -Infinity) < filters.minParking) return false;
  if (filters.amenities?.length && !filters.amenities.every((a) => (property.amenities || []).includes(a))) return false;
  return true;
}

// "newest" en modo local es orden de inserción invertido — a diferencia
// de Supabase, los registros sembrados/agregados aquí no tienen un
// created_at real que ordenar.
const SORTERS = {
  newest: (list) => list.slice().reverse(),
  price_asc: (list) => list.slice().sort((a, b) => a.price - b.price),
  price_desc: (list) => list.slice().sort((a, b) => b.price - a.price),
  area_desc: (list) => list.slice().sort((a, b) => b.area_m2 - a.area_m2),
};

const authListeners = new Set();

function getSession() {
  try {
    return JSON.parse(window.localStorage.getItem(KEYS.session) || "null");
  } catch {
    return null;
  }
}

function notifyAuthListeners() {
  const session = getSession();
  authListeners.forEach((cb) => cb(session));
}

export const localBackend = {
  mode: "local",

  async getProperties(filters = {}) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const filtered = properties.filter((p) => matchesFilters(p, filters));
    const sorted = (SORTERS[filters.sortBy] || SORTERS.newest)(filtered);
    return sorted.map((p) => withAdvisors(p, advisors));
  },

  async getPropertyById(id) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const found = properties.find((p) => p.id === id);
    return found ? withAdvisors(found, advisors) : null;
  },

  async getPropertyByCode(code) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const normalized = code.trim().toUpperCase();
    const found = properties.find((p) => p.code === normalized);
    return found ? withAdvisors(found, advisors) : null;
  },

  async addProperty(data) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const newImages = await filesToDataUrls(await compressImageFiles(data.imageFiles));
    const images = [...(data.existingImages || []), ...newImages];
    const newVideos = await filesToDataUrls(data.videoFiles);
    const videos = [...(data.existingVideos || []), ...newVideos];
    const record = {
      id: uid("prop"),
      code: nextPropertyCode(),
      title: data.title,
      type: data.type,
      description: data.description,
      price: Number(data.price),
      area_m2: Number(data.area_m2),
      bedrooms: data.bedrooms === "" ? null : Number(data.bedrooms),
      bathrooms: data.bathrooms === "" ? null : Number(data.bathrooms),
      parking: data.parking === "" ? null : Number(data.parking),
      zone: data.zone,
      address: data.address,
      lat: Number(data.lat),
      lng: Number(data.lng),
      status: data.status || "disponible",
      operation_type: data.operation_type || "compra",
      active: data.active !== false,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      videos,
      advisor_ids: data.advisor_ids || [],
      colindancias: data.colindancias || null,
      servicios: data.servicios || null,
      acabados: data.acabados || null,
      sistema_constructivo: data.sistema_constructivo || null,
      techumbre: data.techumbre || null,
      condicion_propiedad: data.condicion_propiedad || null,
      estatus_construccion: data.estatus_construccion || null,
      altura_libre: numOrNull(data.altura_libre),
      anio_construccion: numOrNull(data.anio_construccion),
      area_minima_divisible: numOrNull(data.area_minima_divisible),
      area_oficina: numOrNull(data.area_oficina),
      luz_natural_pct: numOrNull(data.luz_natural_pct),
      sistema_contra_incendios: data.sistema_contra_incendios || null,
      tipo_seguridad: data.tipo_seguridad || null,
      andenes_carga: numOrNull(data.andenes_carga),
      rampas_vehiculares: numOrNull(data.rampas_vehiculares),
      mantenimiento_pct: numOrNull(data.mantenimiento_pct),
      tipo_nave: data.tipo_nave || null,
      amenities: data.amenities || [],
      created_at: new Date().toISOString(),
    };
    properties.push(record);
    writeStoreOrThrowFriendly(KEYS.properties, properties);
    // Cada propiedad nueva llega ya con su proyecto de remodelación
    // vinculado — no requiere seleccionarse/capturarse a mano en
    // Remodelaciones (ver integración Propiedades → Remodelaciones →
    // Liquidación).
    await this.addRemodelProject({
      name: record.title,
      property_id: record.id,
      area_m2: record.area_m2,
      materials: [],
      spaces: [],
    });
    return record;
  },

  async applyConstruccionToProperty() {
    throw new Error("Aplicar datos a una propiedad requiere Supabase conectado (modo demo).");
  },

  async updateProperty(id, data) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const idx = properties.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Propiedad no encontrada");
    const newImages = await filesToDataUrls(await compressImageFiles(data.imageFiles));
    const images = [...(data.existingImages || []), ...newImages];
    const newVideos = await filesToDataUrls(data.videoFiles);
    const videos = [...(data.existingVideos || []), ...newVideos];
    const updated = {
      ...properties[idx],
      title: data.title,
      type: data.type,
      description: data.description,
      price: Number(data.price),
      area_m2: Number(data.area_m2),
      bedrooms: data.bedrooms === "" ? null : Number(data.bedrooms),
      bathrooms: data.bathrooms === "" ? null : Number(data.bathrooms),
      parking: data.parking === "" ? null : Number(data.parking),
      zone: data.zone,
      address: data.address,
      lat: Number(data.lat),
      lng: Number(data.lng),
      status: data.status,
      operation_type: data.operation_type || "compra",
      active: data.active,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      videos,
      advisor_ids: data.advisor_ids || [],
      colindancias: data.colindancias || null,
      servicios: data.servicios || null,
      acabados: data.acabados || null,
      sistema_constructivo: data.sistema_constructivo || null,
      techumbre: data.techumbre || null,
      condicion_propiedad: data.condicion_propiedad || null,
      estatus_construccion: data.estatus_construccion || null,
      altura_libre: numOrNull(data.altura_libre),
      anio_construccion: numOrNull(data.anio_construccion),
      area_minima_divisible: numOrNull(data.area_minima_divisible),
      area_oficina: numOrNull(data.area_oficina),
      luz_natural_pct: numOrNull(data.luz_natural_pct),
      sistema_contra_incendios: data.sistema_contra_incendios || null,
      tipo_seguridad: data.tipo_seguridad || null,
      andenes_carga: numOrNull(data.andenes_carga),
      rampas_vehiculares: numOrNull(data.rampas_vehiculares),
      mantenimiento_pct: numOrNull(data.mantenimiento_pct),
      tipo_nave: data.tipo_nave || null,
      amenities: data.amenities || [],
      updated_at: new Date().toISOString(),
    };
    // Modo demo del "Historial" del admin: en Supabase esto lo hace un
    // trigger (log_property_changes(), corre pase lo que pase); aquí no
    // hay trigger real, así que se replica a mano justo antes de guardar,
    // comparando el registro viejo contra el nuevo.
    const changes = readStore(KEYS.propertyChanges, []);
    const previous = properties[idx];
    if (previous.price !== updated.price) {
      changes.push({
        id: uid("change"),
        property_id: id,
        changed_by: "Modo demo",
        field: "price",
        old_value: String(previous.price),
        new_value: String(updated.price),
        created_at: new Date().toISOString(),
      });
    }
    if (previous.status !== updated.status) {
      changes.push({
        id: uid("change"),
        property_id: id,
        changed_by: "Modo demo",
        field: "status",
        old_value: previous.status,
        new_value: updated.status,
        created_at: new Date().toISOString(),
      });
    }
    writeStore(KEYS.propertyChanges, changes);
    properties[idx] = updated;
    writeStoreOrThrowFriendly(KEYS.properties, properties);
    return updated;
  },

  async getPropertyChanges(propertyId) {
    const changes = readStore(KEYS.propertyChanges, []);
    return changes
      .filter((c) => c.property_id === propertyId)
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async deleteProperty(id) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    writeStore(
      KEYS.properties,
      properties.filter((p) => p.id !== id)
    );
    // Igual que el ON DELETE CASCADE de Supabase: la bitácora y el
    // presupuesto de la casa se van con ella.
    writeStore(KEYS.propertyLog, readStore(KEYS.propertyLog, []).filter((e) => e.property_id !== id));
    writeStore(KEYS.propertyBudgets, readStore(KEYS.propertyBudgets, []).filter((b) => b.property_id !== id));
    writeStore(KEYS.visits, readStore(KEYS.visits, VISITS_SEED).filter((v) => v.property_id !== id));
    writeStore(KEYS.reportLinks, readStore(KEYS.reportLinks, []).filter((l) => l.property_id !== id));
  },

  async getAdvisors() {
    return readStore(KEYS.advisors, ADVISORS);
  },

  async getAdvisorById(id) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    return advisors.find((a) => a.id === id) || null;
  },

  async addAdvisor(data) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    let photo_url = data.existingPhoto || "";
    if (data.photoFile) photo_url = await fileToDataUrl(await compressImageFile(data.photoFile));
    const record = {
      id: uid("advisor"),
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsapp: data.whatsapp,
      bio: data.bio,
      photo_url,
      active: data.active !== false,
      show_in_team: data.show_in_team !== false,
    };
    advisors.push(record);
    writeStore(KEYS.advisors, advisors);
    return record;
  },

  async updateAdvisor(id, data) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const idx = advisors.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Asesor no encontrado");
    let photo_url = data.existingPhoto || advisors[idx].photo_url;
    if (data.photoFile) photo_url = await fileToDataUrl(await compressImageFile(data.photoFile));
    const updated = { ...advisors[idx], ...data, photo_url };
    delete updated.photoFile;
    delete updated.existingPhoto;
    advisors[idx] = updated;
    writeStore(KEYS.advisors, advisors);
    return updated;
  },

  async deleteAdvisor(id) {
    const advisors = readStore(KEYS.advisors, ADVISORS);
    writeStore(
      KEYS.advisors,
      advisors.filter((a) => a.id !== id)
    );
  },

  async getZones() {
    return readStore(KEYS.zones, ZONES);
  },

  async addZone(data) {
    const zones = readStore(KEYS.zones, ZONES);
    const name = data.name.trim();
    if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      throw new Error("Ya existe una zona con ese nombre");
    }
    const record = {
      id: uid("zone"),
      name,
      price_per_m2: Number(data.price_per_m2) || 0,
      land_price_per_m2: Number(data.land_price_per_m2) || 0,
    };
    zones.push(record);
    writeStore(KEYS.zones, zones);
    return record;
  },

  async deleteZone(id) {
    const zones = readStore(KEYS.zones, ZONES);
    writeStore(KEYS.zones, zones.filter((z) => z.id !== id));
  },

  // Igual que en supabaseBackend: properties.zone guarda el nombre como texto,
  // así que las propiedades de la zona se renombran junto con ella.
  async renameZone(id, name) {
    const zones = readStore(KEYS.zones, ZONES);
    const idx = zones.findIndex((z) => z.id === id);
    if (idx === -1) throw new Error("Zona no encontrada");
    const newName = name.trim();
    if (zones.some((z) => z.id !== id && z.name.toLowerCase() === newName.toLowerCase())) {
      throw new Error("Ya existe una zona con ese nombre");
    }
    const oldName = zones[idx].name;
    zones[idx] = { ...zones[idx], name: newName };
    const properties = readStore(KEYS.properties, PROPERTIES).map((p) => (p.zone === oldName ? { ...p, zone: newName } : p));
    writeStore(KEYS.zones, zones);
    writeStore(KEYS.properties, properties);
    return zones[idx];
  },

  // `land_price_per_m2` es opcional: undefined = no tocar (ver supabaseBackend).
  async updateZonePrice(id, price_per_m2, land_price_per_m2) {
    const zones = readStore(KEYS.zones, ZONES);
    const idx = zones.findIndex((z) => z.id === id);
    if (idx === -1) throw new Error("Zona no encontrada");
    zones[idx] = { ...zones[idx], price_per_m2: Number(price_per_m2) };
    if (land_price_per_m2 !== undefined) zones[idx].land_price_per_m2 = Number(land_price_per_m2) || 0;
    writeStore(KEYS.zones, zones);
    return zones[idx];
  },

  async getPropertyTypes() {
    return readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
  },

  async addPropertyType(data) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const label = data.label.trim();
    const key = slugify(label);
    if (types.some((t) => t.key === key)) {
      throw new Error("Ya existe un tipo de propiedad con ese nombre");
    }
    const record = { id: uid("type"), key, label };
    types.push(record);
    writeStore(KEYS.propertyTypes, types);
    return record;
  },

  async deletePropertyType(id) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    writeStore(KEYS.propertyTypes, types.filter((t) => t.id !== id));
  },

  async renamePropertyType(id, label) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const idx = types.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Tipo de propiedad no encontrado");
    types[idx] = { ...types[idx], label: label.trim() };
    writeStore(KEYS.propertyTypes, types);
    return types[idx];
  },

  async getAmenities() {
    return readStore(KEYS.amenities, AMENITIES_SEED);
  },

  async addAmenity(data) {
    const amenities = readStore(KEYS.amenities, AMENITIES_SEED);
    const label = data.label.trim();
    const key = slugify(label);
    if (amenities.some((a) => a.key === key)) {
      throw new Error("Ya existe una amenidad con ese nombre");
    }
    const record = { id: uid("amenity"), key, label, active: true };
    amenities.push(record);
    writeStore(KEYS.amenities, amenities);
    return record;
  },

  async renameAmenity(id, label) {
    const amenities = readStore(KEYS.amenities, AMENITIES_SEED);
    const idx = amenities.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Amenidad no encontrada");
    amenities[idx] = { ...amenities[idx], label: label.trim() };
    writeStore(KEYS.amenities, amenities);
    return amenities[idx];
  },

  async deleteAmenity(id) {
    const amenities = readStore(KEYS.amenities, AMENITIES_SEED);
    writeStore(KEYS.amenities, amenities.filter((a) => a.id !== id));
  },

  async getTestimonials() {
    const testimonials = readStore(KEYS.testimonials, []);
    return testimonials.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async addTestimonial(data) {
    const testimonials = readStore(KEYS.testimonials, []);
    const record = {
      id: uid("testimonial"),
      name: data.name.trim(),
      role: data.role?.trim() || null,
      quote: data.quote.trim(),
      rating: Number(data.rating) || 5,
      active: true,
      created_at: new Date().toISOString(),
    };
    testimonials.push(record);
    writeStore(KEYS.testimonials, testimonials);
    return record;
  },

  async updateTestimonial(id, data) {
    const testimonials = readStore(KEYS.testimonials, []);
    const idx = testimonials.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Testimonio no encontrado");
    testimonials[idx] = {
      ...testimonials[idx],
      name: data.name.trim(),
      role: data.role?.trim() || null,
      quote: data.quote.trim(),
      rating: Number(data.rating) || 5,
    };
    writeStore(KEYS.testimonials, testimonials);
    return testimonials[idx];
  },

  async toggleTestimonialActive(id, active) {
    const testimonials = readStore(KEYS.testimonials, []);
    const idx = testimonials.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Testimonio no encontrado");
    testimonials[idx] = { ...testimonials[idx], active };
    writeStore(KEYS.testimonials, testimonials);
    return testimonials[idx];
  },

  async deleteTestimonial(id) {
    const testimonials = readStore(KEYS.testimonials, []);
    writeStore(KEYS.testimonials, testimonials.filter((t) => t.id !== id));
  },

  async getBlogPosts({ publishedOnly = false } = {}) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    const filtered = publishedOnly ? posts.filter((p) => p.published) : posts;
    return filtered.slice().sort((a, b) => {
      const da = publishedOnly ? a.published_at : a.created_at;
      const db_ = publishedOnly ? b.published_at : b.created_at;
      return new Date(db_) - new Date(da);
    });
  },

  async getBlogPostBySlug(slug) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    return posts.find((p) => p.slug === slug && p.published) || null;
  },

  async addBlogPost(data) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    let slug = slugify(data.title);
    if (posts.some((p) => p.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const record = {
      id: uid("blog"),
      title: data.title.trim(),
      slug,
      excerpt: data.excerpt?.trim() || null,
      body: data.body.trim(),
      cover_image: data.coverFile ? await fileToDataUrl(data.coverFile) : null,
      published: Boolean(data.published),
      published_at: data.published ? now : null,
      created_at: now,
      updated_at: now,
    };
    posts.push(record);
    writeStore(KEYS.blogPosts, posts);
    return record;
  },

  async updateBlogPost(id, data, existing) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Artículo no encontrado");
    const current = posts[idx];
    posts[idx] = {
      ...current,
      title: data.title.trim(),
      excerpt: data.excerpt?.trim() || null,
      body: data.body.trim(),
      published: Boolean(data.published),
      published_at: data.published ? current.published_at || (existing?.published_at ?? new Date().toISOString()) : current.published_at,
      cover_image: data.coverFile ? await fileToDataUrl(data.coverFile) : data.removeCover ? null : current.cover_image,
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.blogPosts, posts);
    return posts[idx];
  },

  async deleteBlogPost(id) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    writeStore(KEYS.blogPosts, posts.filter((p) => p.id !== id));
  },

  // Modo demo no tiene backend de correo real (eso solo existe con Supabase
  // + la Edge Function enviar-correo) — simula el envío para que el botón se
  // pueda probar sin tronar.
  async sendEmail({ to }) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: true, demo: true, to };
  },

  async togglePropertyTypeActive(id, active) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const idx = types.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Tipo de propiedad no encontrado");
    types[idx] = { ...types[idx], active };
    writeStore(KEYS.propertyTypes, types);
    return types[idx];
  },

  async updatePropertyTypeImage(id, file) {
    const types = readStore(KEYS.propertyTypes, PROPERTY_TYPES_SEED);
    const idx = types.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error("Tipo de propiedad no encontrado");
    const [image_url] = await filesToDataUrls(await compressImageFiles([file]));
    types[idx] = { ...types[idx], image_url };
    writeStore(KEYS.propertyTypes, types);
    return types[idx];
  },

  async submitContactMessage(data) {
    const messages = readStore(KEYS.messages, []);
    messages.push({ id: uid("msg"), ...data, status: "nuevo", created_at: new Date().toISOString() });
    writeStore(KEYS.messages, messages);
    return true;
  },

  async getContactMessages() {
    const messages = readStore(KEYS.messages, []);
    return messages.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async updateContactMessageStatus(id, status) {
    const messages = readStore(KEYS.messages, []);
    const idx = messages.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Mensaje no encontrado");
    messages[idx] = { ...messages[idx], status };
    writeStore(KEYS.messages, messages);
    return messages[idx];
  },

  async deleteContactMessage(id) {
    const messages = readStore(KEYS.messages, []);
    writeStore(KEYS.messages, messages.filter((m) => m.id !== id));
    return true;
  },

  async getClients(filters = {}) {
    const clients = readStore(KEYS.clients, []);
    return clients
      .filter((c) => !filters.type || c.type === filters.type)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getClientById(id) {
    const clients = readStore(KEYS.clients, []);
    return clients.find((c) => c.id === id) || null;
  },

  async addClient(data) {
    const clients = readStore(KEYS.clients, []);
    const record = {
      id: uid("client"),
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
      ...clientExpedientePayload(data),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    clients.push(record);
    writeStore(KEYS.clients, clients);
    return record;
  },

  async updateClient(id, data) {
    const clients = readStore(KEYS.clients, []);
    const idx = clients.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cliente no encontrado");
    const updated = {
      ...clients[idx],
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
      ...clientExpedientePayload(data),
      updated_at: new Date().toISOString(),
    };
    clients[idx] = updated;
    writeStore(KEYS.clients, clients);
    return updated;
  },

  async deleteClient(id) {
    const clients = readStore(KEYS.clients, []);
    writeStore(KEYS.clients, clients.filter((c) => c.id !== id));
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(KEYS.clientDocuments, docs.filter((d) => d.client_id !== id));
    writeStore(KEYS.clientPortalTokens, readStore(KEYS.clientPortalTokens, []).filter((t) => t.client_id !== id));
  },

  async getClientDocuments(clientId) {
    const docs = readStore(KEYS.clientDocuments, []);
    return docs
      .filter((d) => d.client_id === clientId)
      .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
      .map((d) => ({
        source: "admin_capture",
        file_kind: "document",
        extracted_data: {},
        qr_validated: null,
        review_status: "pendiente",
        review_notes: null,
        client_confirmed: false,
        ...d,
        signed_url: d.file_path,
      }));
  },

  // En demo file_path ya es la data URL completa (no expira, no requiere
  // firmarse) — existe solo para que el llamador no necesite distinguir
  // backend real vs demo antes de descargar/previsualizar un documento.
  async getClientDocumentUrl(doc) {
    return doc.file_path;
  },

  async addClientDocument({ client_id, doc_type, blob, quality_metrics }) {
    const docs = readStore(KEYS.clientDocuments, []);
    const file_path = await fileToDataUrl(blob);
    const record = {
      id: uid("doc"),
      client_id,
      doc_type,
      file_path,
      quality_metrics: quality_metrics || {},
      captured_at: new Date().toISOString(),
    };
    docs.push(record);
    writeStore(KEYS.clientDocuments, docs);
    return record;
  },

  async deleteClientDocument(id) {
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(KEYS.clientDocuments, docs.filter((d) => d.id !== id));
  },

  async getClientLink(clientId) {
    const links = readStore(KEYS.clientLinks, []);
    const link = links.find((l) => l.client_a_id === clientId || l.client_b_id === clientId);
    if (!link) return null;
    const otherId = link.client_a_id === clientId ? link.client_b_id : link.client_a_id;
    const other = await this.getClientById(otherId);
    return { ...link, other_client: other };
  },

  async linkClients(clientAId, clientBId, label) {
    const links = readStore(KEYS.clientLinks, []);
    const record = { id: uid("link"), client_a_id: clientAId, client_b_id: clientBId, label: label || null, created_at: new Date().toISOString() };
    links.push(record);
    writeStore(KEYS.clientLinks, links);
    return record;
  },

  async unlinkClients(linkId) {
    const links = readStore(KEYS.clientLinks, []);
    writeStore(KEYS.clientLinks, links.filter((l) => l.id !== linkId));
  },

  // ── Portal de documentos para clientes — modo demo ──
  async getClientPortalToken(clientId) {
    return readStore(KEYS.clientPortalTokens, []).find((t) => t.client_id === clientId) || null;
  },

  async saveClientPortalToken(clientId) {
    const tokens = readStore(KEYS.clientPortalTokens, []).filter((t) => t.client_id !== clientId);
    const record = {
      id: uid("portaltoken"),
      client_id: clientId,
      token: generatePortalToken(),
      active: true,
      created_by: DEMO_ADMIN.email,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + PORTAL_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      last_accessed_at: null,
    };
    tokens.push(record);
    writeStore(KEYS.clientPortalTokens, tokens);
    return record;
  },

  async revokeClientPortalToken(clientId) {
    const tokens = readStore(KEYS.clientPortalTokens, []);
    writeStore(
      KEYS.clientPortalTokens,
      tokens.map((t) => (t.client_id === clientId ? { ...t, active: false } : t))
    );
  },

  async reviewClientDocument(documentId, clientId, { reviewStatus, reviewNotes }) {
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(
      KEYS.clientDocuments,
      docs.map((d) =>
        d.id === documentId
          ? { ...d, review_status: reviewStatus, review_notes: reviewNotes || null, reviewed_by: DEMO_ADMIN.email, reviewed_at: new Date().toISOString() }
          : d
      )
    );
    const log = readStore(KEYS.documentAccessLog, []);
    log.push({
      id: uid("doclog"),
      client_document_id: documentId,
      client_id: clientId,
      actor_type: "admin",
      actor_ref: DEMO_ADMIN.email,
      action: reviewStatus === "rechazado" ? "reject" : "approve",
      created_at: new Date().toISOString(),
    });
    writeStore(KEYS.documentAccessLog, log);
  },

  // Lado del cliente (sin sesión): en demo no hay token de verdad guardado
  // aparte de localStorage de ESTE navegador, así que solo sirve para
  // probar el flujo completo, no para compartir un enlace real.
  async getPortalStatus(token) {
    if (!PORTAL_TOKEN_PATTERN.test(token || "")) return { status: "invalido" };
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) return { status: "invalido" };
    if (!t.active) return { status: "desactivado" };
    if (new Date(t.expires_at).getTime() < Date.now()) return { status: "expirado" };
    const client = await this.getClientById(t.client_id);
    const docs = readStore(KEYS.clientDocuments, [])
      .filter((d) => d.client_id === t.client_id && d.source === "client_portal")
      .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at));
    return { status: "activo", client_name: (client?.name || "").split(" ")[0], documents: docs };
  },

  async registerPortalConsent(token, consentVersion) {
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) return { error: "not_found" };
    const consents = readStore(KEYS.privacyConsents, []);
    consents.push({ id: uid("consent"), client_id: t.client_id, token_id: t.id, consent_version: consentVersion, accepted_at: new Date().toISOString() });
    writeStore(KEYS.privacyConsents, consents);
    return { ok: true };
  },

  async confirmPortalDocument(token, documentId, extractedData, clientConfirmed) {
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) return { error: "invalid_token" };
    const docs = readStore(KEYS.clientDocuments, []);
    writeStore(
      KEYS.clientDocuments,
      docs.map((d) => (d.id === documentId && d.client_id === t.client_id ? { ...d, extracted_data: extractedData, client_confirmed: clientConfirmed } : d))
    );
    return { ok: true };
  },

  // Sin servidor en modo demo: no hay lectura real de texto/QR, solo se
  // guarda el archivo (como data URL, igual que el resto del modo demo) y
  // queda marcado para revisión manual — se avisa en pantalla que es demo.
  async uploadPortalDocument(token, { docType, fileKind, file }) {
    const t = readStore(KEYS.clientPortalTokens, []).find((x) => x.token === token);
    if (!t) throw new Error("invalid_token");
    const file_path = await fileToDataUrl(file);
    const record = {
      id: uid("doc"),
      client_id: t.client_id,
      doc_type: docType,
      file_path,
      source: "client_portal",
      file_kind: fileKind,
      quality_metrics: {},
      extracted_data: fileKind === "document" ? { nota: "Modo demo: sin validación automática (sin servidor)." } : {},
      qr_validated: null,
      review_status: fileKind === "document" ? "requiere_revision" : "pendiente",
      client_confirmed: false,
      captured_at: new Date().toISOString(),
    };
    const docs = readStore(KEYS.clientDocuments, []);
    docs.push(record);
    writeStore(KEYS.clientDocuments, docs);
    return record;
  },

  async getRemodelProjects(filters = {}) {
    const projects = readStore(KEYS.remodelProjects, []);
    return projects
      .filter((p) => !filters.client_id || p.client_id === filters.client_id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getRemodelProjectById(id) {
    const projects = readStore(KEYS.remodelProjects, []);
    return projects.find((p) => p.id === id) || null;
  },

  // El proyecto que se creó automáticamente al dar de alta la propiedad
  // (ver addProperty). Alimenta "Inversión — costo de remodelación" en
  // Liquidación.
  async getRemodelProjectByProperty(propertyId) {
    const projects = readStore(KEYS.remodelProjects, []);
    return projects.find((p) => p.property_id === propertyId) || null;
  },

  async addRemodelProject(data) {
    const projects = readStore(KEYS.remodelProjects, []);
    const record = {
      id: uid("remodel"),
      name: data.name,
      client_id: data.client_id || null,
      property_id: data.property_id || null,
      area_m2: Number(data.area_m2),
      notes: data.notes || null,
      materials: data.materials || [],
      spaces: data.spaces || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    projects.push(record);
    writeStore(KEYS.remodelProjects, projects);
    return record;
  },

  async updateRemodelProject(id, data) {
    const projects = readStore(KEYS.remodelProjects, []);
    const idx = projects.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Proyecto no encontrado");
    const updated = {
      ...projects[idx],
      name: data.name,
      client_id: data.client_id || null,
      area_m2: Number(data.area_m2),
      notes: data.notes || null,
      materials: data.materials || [],
      spaces: data.spaces || [],
      updated_at: new Date().toISOString(),
    };
    projects[idx] = updated;
    writeStore(KEYS.remodelProjects, projects);
    return updated;
  },

  async deleteRemodelProject(id) {
    const projects = readStore(KEYS.remodelProjects, []);
    writeStore(KEYS.remodelProjects, projects.filter((p) => p.id !== id));
  },

  async getRemodelProgress(remodelProjectId) {
    const entries = readStore(KEYS.remodelProgress, []);
    return entries
      .filter((e) => e.remodel_project_id === remodelProjectId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((e) => ({ ...e, signed_url: e.file_path }));
  },

  async addRemodelProgress({ remodel_project_id, entry_type, blob, note }) {
    const entries = readStore(KEYS.remodelProgress, []);
    const file_path = await fileToDataUrl(blob);
    const record = {
      id: uid("progress"),
      remodel_project_id,
      entry_type,
      file_path,
      note: note || null,
      created_at: new Date().toISOString(),
    };
    entries.push(record);
    writeStore(KEYS.remodelProgress, entries);
    return record;
  },

  async deleteRemodelProgress(id) {
    const entries = readStore(KEYS.remodelProgress, []);
    writeStore(KEYS.remodelProgress, entries.filter((e) => e.id !== id));
  },

  async getMaterialsCatalog(filters = {}) {
    const items = readStore(KEYS.materialsCatalog, []);
    return items
      .filter((m) => !filters.activeOnly || m.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async getMaterialCatalogItemById(id) {
    const items = readStore(KEYS.materialsCatalog, []);
    return items.find((m) => m.id === id) || null;
  },

  async addMaterialCatalogItem(data) {
    const items = readStore(KEYS.materialsCatalog, []);
    const record = {
      id: uid("material"),
      name: data.name,
      category: data.category || null,
      unit: data.unit || null,
      unit_price_internal: data.unit_price_internal === "" ? null : Number(data.unit_price_internal),
      unit_price_external: data.unit_price_external === "" ? null : Number(data.unit_price_external),
      consumption_rate: data.consumption_rate === "" || data.consumption_rate == null ? null : Number(data.consumption_rate),
      consumption_basis: data.consumption_basis || null,
      active: data.active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    items.push(record);
    writeStore(KEYS.materialsCatalog, items);
    return record;
  },

  async updateMaterialCatalogItem(id, data) {
    const items = readStore(KEYS.materialsCatalog, []);
    const idx = items.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Material no encontrado");
    const updated = {
      ...items[idx],
      name: data.name,
      category: data.category || null,
      unit: data.unit || null,
      unit_price_internal: data.unit_price_internal === "" ? null : Number(data.unit_price_internal),
      unit_price_external: data.unit_price_external === "" ? null : Number(data.unit_price_external),
      consumption_rate: data.consumption_rate === "" || data.consumption_rate == null ? null : Number(data.consumption_rate),
      consumption_basis: data.consumption_basis || null,
      active: data.active !== false,
      updated_at: new Date().toISOString(),
    };
    items[idx] = updated;
    writeStore(KEYS.materialsCatalog, items);
    return updated;
  },

  async deleteMaterialCatalogItem(id) {
    const items = readStore(KEYS.materialsCatalog, []);
    writeStore(KEYS.materialsCatalog, items.filter((m) => m.id !== id));
  },

  async getLaborCatalog() {
    const items = readStore(KEYS.laborCatalog, []);
    return items.slice().sort((a, b) => a.concepto.localeCompare(b.concepto));
  },

  async addLaborCatalogItem(data) {
    const items = readStore(KEYS.laborCatalog, []);
    const record = {
      id: uid("labor"),
      concepto: data.concepto.trim(),
      unidad: data.unidad?.trim() || null,
      precio_unitario: data.precio_unitario === "" ? null : Number(data.precio_unitario),
    };
    items.push(record);
    writeStore(KEYS.laborCatalog, items);
    return record;
  },

  async updateLaborPrice(id, precio_unitario) {
    const items = readStore(KEYS.laborCatalog, []);
    const idx = items.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Concepto de mano de obra no encontrado");
    items[idx] = { ...items[idx], precio_unitario: Number(precio_unitario) };
    writeStore(KEYS.laborCatalog, items);
    return items[idx];
  },

  async deleteLaborCatalogItem(id) {
    const items = readStore(KEYS.laborCatalog, []);
    writeStore(KEYS.laborCatalog, items.filter((m) => m.id !== id));
  },

  // Igual que en Supabase: la lista no incluye RFC/CURP/identificación.
  async getPerfilamientosVendedor(clienteId) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    return items
      .filter((p) => p.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .map((p) => Object.fromEntries(PERFILAMIENTO_VENDEDOR_LIST_FIELDS.map((key) => [key, p[key]])));
  },

  async getPerfilamientoVendedorById(id) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    return items.find((p) => p.id === id) || null;
  },

  async addPerfilamientoVendedor(clienteId, payload) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("perf"),
      cliente_id: clienteId,
      ...payload,
      usuario_creo: DEMO_ADMIN.email,
      fecha_creacion: now,
      fecha_modificacion: now,
    };
    items.push(record);
    writeStore(KEYS.perfilamientosVendedor, items);
    return record;
  },

  async updatePerfilamientoVendedor(id, payload) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Perfilamiento no encontrado");
    const updated = { ...items[idx], ...payload, fecha_modificacion: new Date().toISOString() };
    items[idx] = updated;
    writeStore(KEYS.perfilamientosVendedor, items);
    return updated;
  },

  async deletePerfilamientoVendedor(id) {
    const items = readStore(KEYS.perfilamientosVendedor, []);
    writeStore(KEYS.perfilamientosVendedor, items.filter((p) => p.id !== id));
  },

  // Igual que en Supabase: la lista no incluye NSS/CURP/RFC/contraseña de portal.
  async getPerfilamientosComprador(clienteId) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    return items
      .filter((p) => p.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .map((p) => Object.fromEntries(PERFILAMIENTO_COMPRADOR_LIST_FIELDS.map((key) => [key, p[key]])));
  },

  async getPerfilamientoCompradorById(id) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    return items.find((p) => p.id === id) || null;
  },

  async addPerfilamientoComprador(clienteId, payload) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("perf"),
      cliente_id: clienteId,
      ...payload,
      usuario_creo: DEMO_ADMIN.email,
      fecha_creacion: now,
      fecha_modificacion: now,
    };
    items.push(record);
    writeStore(KEYS.perfilamientosComprador, items);
    return record;
  },

  async updatePerfilamientoComprador(id, payload) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Perfilamiento no encontrado");
    const updated = { ...items[idx], ...payload, fecha_modificacion: new Date().toISOString() };
    items[idx] = updated;
    writeStore(KEYS.perfilamientosComprador, items);
    return updated;
  },

  async deletePerfilamientoComprador(id) {
    const items = readStore(KEYS.perfilamientosComprador, []);
    writeStore(KEYS.perfilamientosComprador, items.filter((p) => p.id !== id));
  },

  // En modo demo no hay restricción real de socios (ver AuthContext) — es
  // un sandbox local, no un límite de seguridad.
  async getLiquidacionByProperty(propertyId) {
    const items = readStore(KEYS.liquidaciones, []);
    return items.find((l) => l.property_id === propertyId) || null;
  },

  async addLiquidacion(propertyId, payload) {
    const items = readStore(KEYS.liquidaciones, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("liq"),
      property_id: propertyId,
      ...payload,
      usuario_actualizo: DEMO_ADMIN.email,
      created_at: now,
      updated_at: now,
    };
    items.push(record);
    writeStore(KEYS.liquidaciones, items);
    return record;
  },

  async updateLiquidacion(id, payload) {
    const items = readStore(KEYS.liquidaciones, []);
    const idx = items.findIndex((l) => l.id === id);
    if (idx === -1) throw new Error("Liquidación no encontrada");
    const updated = { ...items[idx], ...payload, usuario_actualizo: DEMO_ADMIN.email, updated_at: new Date().toISOString() };
    items[idx] = updated;
    writeStore(KEYS.liquidaciones, items);
    return updated;
  },

  async getLiquidaciones() {
    return readStore(KEYS.liquidaciones, []);
  },

  // Cambia solo el estatus de una propiedad (sin pasar por el formulario
  // completo, que exige reenviar fotos, asesores, etc.). Replica a mano el
  // registro del Historial que en Supabase hace el trigger.
  async setPropertyStatus(id, status) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const idx = properties.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Propiedad no encontrada");
    if (properties[idx].status === status) return properties[idx];
    const changes = readStore(KEYS.propertyChanges, []);
    changes.push({
      id: uid("change"),
      property_id: id,
      changed_by: "Modo demo",
      field: "status",
      old_value: properties[idx].status,
      new_value: status,
      created_at: new Date().toISOString(),
    });
    writeStore(KEYS.propertyChanges, changes);
    properties[idx] = { ...properties[idx], status, updated_at: new Date().toISOString() };
    writeStore(KEYS.properties, properties);
    return properties[idx];
  },

  // Ventas registradas (quién vendió y cuándo). Una por propiedad. Registrar
  // una venta también deja la propiedad en "vendida"; deshacerla la regresa
  // a "disponible" — así el estatus público y el reporte no se contradicen.
  async getVentas() {
    return readStore(KEYS.ventas, VENTAS_SEED);
  },

  async saveVenta(propertyId, { advisor_id, fecha_venta }) {
    const items = readStore(KEYS.ventas, VENTAS_SEED);
    const idx = items.findIndex((v) => v.property_id === propertyId);
    const record = {
      id: idx === -1 ? uid("venta") : items[idx].id,
      property_id: propertyId,
      advisor_id: advisor_id || null,
      fecha_venta,
      usuario_registro: DEMO_ADMIN.email,
      created_at: idx === -1 ? new Date().toISOString() : items[idx].created_at,
    };
    if (idx === -1) items.push(record);
    else items[idx] = record;
    writeStore(KEYS.ventas, items);
    await this.setPropertyStatus(propertyId, "vendida");
    return record;
  },

  async deleteVenta(id, propertyId) {
    const items = readStore(KEYS.ventas, VENTAS_SEED);
    writeStore(KEYS.ventas, items.filter((v) => v.id !== id));
    await this.setPropertyStatus(propertyId, "disponible");
  },

  // Bitácora y gastos por propiedad (modo demo: el comprobante vive como
  // data: URL en localStorage, así que el tope real es la cuota del navegador).
  async getPropertyLog(propertyId) {
    const entries = readStore(KEYS.propertyLog, [])
      .filter((e) => e.property_id === propertyId)
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date) || String(b.created_at).localeCompare(String(a.created_at)));
    // Chrome no deja abrir un data: URL como página (un PDF en otra pestaña
    // sale en blanco); un blob: sí. Se convierte al leer.
    return Promise.all(
      entries.map(async (e) => {
        if (!e.file_path) return e;
        try {
          const blob = await (await fetch(e.file_path)).blob();
          return { ...e, signed_url: URL.createObjectURL(blob) };
        } catch {
          return { ...e, signed_url: e.file_path };
        }
      })
    );
  },

  async getExpenses(propertyId = null) {
    return readStore(KEYS.propertyLog, [])
      .filter((e) => e.kind === "gasto" && (!propertyId || e.property_id === propertyId))
      .map(({ id, property_id, entry_date, categoria, monto }) => ({ id, property_id, entry_date, categoria, monto }));
  },

  async addPropertyLogEntry({ property_id, file, ...fields }) {
    const items = readStore(KEYS.propertyLog, []);
    let stored = { file_path: null, file_name: null, file_type: null };
    if (file) {
      const prepared = await compressImageFile(file);
      const [dataUrl] = await filesToDataUrls([prepared]);
      stored = { file_path: dataUrl, file_name: file.name, file_type: prepared.type || file.type || null };
    }
    const record = {
      id: uid("log"),
      ...fields,
      property_id,
      ...stored,
      created_by: DEMO_ADMIN.email,
      created_at: new Date().toISOString(),
    };
    items.push(record);
    writeStoreOrThrowFriendly(KEYS.propertyLog, items, FILE_QUOTA_MESSAGE);
    return record;
  },

  async updatePropertyLogEntry(id, fields) {
    const items = readStore(KEYS.propertyLog, []);
    const idx = items.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error("Entrada no encontrada");
    items[idx] = { ...items[idx], ...fields };
    writeStore(KEYS.propertyLog, items);
    return items[idx];
  },

  async deletePropertyLogEntry(id) {
    writeStore(KEYS.propertyLog, readStore(KEYS.propertyLog, []).filter((e) => e.id !== id));
  },

  async getPropertyBudget(propertyId) {
    const found = readStore(KEYS.propertyBudgets, []).find((b) => b.property_id === propertyId);
    return found ? Number(found.monto) : null;
  },

  async savePropertyBudget(propertyId, monto) {
    const items = readStore(KEYS.propertyBudgets, []);
    const record = { property_id: propertyId, monto: Number(monto) || 0, updated_at: new Date().toISOString() };
    const idx = items.findIndex((b) => b.property_id === propertyId);
    if (idx === -1) items.push(record);
    else items[idx] = record;
    writeStore(KEYS.propertyBudgets, items);
    return record.monto;
  },

  // Rubros del desglose de gastos (modo demo: localStorage).
  async getExpenseConcepts() {
    return readStore(KEYS.expenseConcepts, []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "es"));
  },

  async saveExpenseConcept(fields, id = null) {
    const items = readStore(KEYS.expenseConcepts, []);
    const now = new Date().toISOString();
    if (!id) {
      const record = { id: uid("gasto"), ...fields, created_at: now, updated_at: now };
      items.push(record);
      writeStore(KEYS.expenseConcepts, items);
      return record;
    }
    const idx = items.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Rubro no encontrado");
    items[idx] = { ...items[idx], ...fields, updated_at: now };
    writeStore(KEYS.expenseConcepts, items);
    return items[idx];
  },

  async addExpenseConcepts(rows) {
    const items = readStore(KEYS.expenseConcepts, []);
    const now = new Date().toISOString();
    const added = rows.map((r) => ({ id: uid("gasto"), ...r, created_at: now, updated_at: now }));
    writeStore(KEYS.expenseConcepts, [...items, ...added]);
    return added;
  },

  async deleteExpenseConcept(id) {
    writeStore(KEYS.expenseConcepts, readStore(KEYS.expenseConcepts, []).filter((c) => c.id !== id));
  },

  // Historial exacto de gastos por casa (modo demo: los renglones se guardan
  // anidados en el mismo registro, sin normalizar en dos tablas).
  async getExpenseReports({ propertyId, houseName } = {}) {
    return readStore(KEYS.expenseReports, [])
      .filter((r) => (!propertyId || r.property_id === propertyId) && (!houseName || r.house_name.toLowerCase() === houseName.toLowerCase()))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async saveExpenseReport(fields) {
    const items = readStore(KEYS.expenseReports, []);
    const record = { id: uid("historial"), created_by: DEMO_ADMIN.email, created_at: new Date().toISOString(), ...fields };
    items.push(record);
    writeStore(KEYS.expenseReports, items);
    return record;
  },

  async deleteExpenseReport(id) {
    writeStore(KEYS.expenseReports, readStore(KEYS.expenseReports, []).filter((r) => r.id !== id));
  },

  async updateExpenseReport(id, fields) {
    const items = readStore(KEYS.expenseReports, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Registro no encontrado");
    items[idx] = { ...items[idx], ...fields, updated_at: new Date().toISOString() };
    writeStore(KEYS.expenseReports, items);
    return items[idx];
  },

  // Visitas de prospectos a una propiedad (modo demo: sin RLS, se ven todas —
  // igual que la agenda, el modo demo resuelve advisorId a null).
  async getVisits({ propertyId } = {}) {
    return readStore(KEYS.visits, VISITS_SEED)
      .filter((v) => !propertyId || v.property_id === propertyId)
      .sort((a, b) => String(b.visited_at).localeCompare(String(a.visited_at)));
  },

  async getVisitById(id) {
    return readStore(KEYS.visits, VISITS_SEED).find((v) => v.id === id) || null;
  },

  async addVisit(fields) {
    const items = readStore(KEYS.visits, VISITS_SEED);
    const now = new Date().toISOString();
    const record = { id: uid("visit"), ...fields, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now };
    items.push(record);
    writeStore(KEYS.visits, items);
    return record;
  },

  async updateVisit(id, fields) {
    const items = readStore(KEYS.visits, VISITS_SEED);
    const idx = items.findIndex((v) => v.id === id);
    if (idx === -1) throw new Error("Visita no encontrada");
    items[idx] = { ...items[idx], ...fields, updated_at: new Date().toISOString() };
    writeStore(KEYS.visits, items);
    return items[idx];
  },

  async deleteVisit(id) {
    writeStore(KEYS.visits, readStore(KEYS.visits, VISITS_SEED).filter((v) => v.id !== id));
  },

  // Cotejo de inspección previo a avalúo (modo demo: localStorage). Cada foto
  // del checklist se guarda como data: URL directamente en `file_path` — a
  // diferencia de property_log no hace falta `signed_url` aparte, el data:
  // URL ya es usable como src de <img> tal cual.
  async getInspections() {
    return readStore(KEYS.inspections, []).sort((a, b) => String(b.visited_at).localeCompare(String(a.visited_at)));
  },

  async getInspectionById(id) {
    return readStore(KEYS.inspections, []).find((i) => i.id === id) || null;
  },

  async _prepareLocalChecklist(checklist) {
    const result = [];
    for (const entry of checklist) {
      if (entry.file) {
        const prepared = await compressImageFile(entry.file);
        const [dataUrl] = await filesToDataUrls([prepared]);
        result.push({ category: entry.category, key: entry.key, estado: entry.estado, file_path: dataUrl });
      } else if (entry.removed) {
        result.push({ category: entry.category, key: entry.key, estado: entry.estado, file_path: null });
      } else {
        result.push({ category: entry.category, key: entry.key, estado: entry.estado, file_path: entry.file_path || null });
      }
    }
    return result;
  },

  async addInspection({ id, checklist, ...fields }) {
    const items = readStore(KEYS.inspections, []);
    const preparedChecklist = await this._prepareLocalChecklist(checklist);
    const now = new Date().toISOString();
    const record = { id, ...fields, checklist: preparedChecklist, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now };
    items.push(record);
    writeStoreOrThrowFriendly(KEYS.inspections, items, FILE_QUOTA_MESSAGE);
    return record;
  },

  async updateInspection(id, { checklist, ...fields }) {
    const items = readStore(KEYS.inspections, []);
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error("Inspección no encontrada");
    const preparedChecklist = await this._prepareLocalChecklist(checklist);
    items[idx] = { ...items[idx], ...fields, checklist: preparedChecklist, updated_at: new Date().toISOString() };
    writeStoreOrThrowFriendly(KEYS.inspections, items, FILE_QUOTA_MESSAGE);
    return items[idx];
  },

  async deleteInspection(id) {
    writeStore(KEYS.inspections, readStore(KEYS.inspections, []).filter((i) => i.id !== id));
  },

  // Firma de contratos (modo demo): mismas reglas que las funciones de la base
  // (código, 5 intentos, vigencia, una sola firma), pero en localStorage.
  async getSigningRequests() {
    return readStore(KEYS.signing, [])
      .map(({ document_b64, signature_b64, fingerprint_b64, code, ...rest }) => rest)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async getSigningRequestFull(id) {
    return readStore(KEYS.signing, []).find((r) => r.id === id) || null;
  },

  async createSigningRequest({ clientId, propertyId, title, signerName, documentB64, expiresDays = 7 }) {
    const { base64ToBytes, sha256Hex } = await import("./signing");
    const bytes = base64ToBytes(documentB64);
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== "%PDF") throw new Error("not_a_pdf");
    const hex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const record = {
      id: uid("sign"),
      token: hex(32),
      client_id: clientId || null,
      property_id: propertyId || null,
      title: title.trim(),
      signer_name: signerName.trim(),
      document_b64: documentB64,
      doc_sha256: await sha256Hex(bytes),
      code,
      failed_attempts: 0,
      status: "pendiente",
      expires_at: new Date(Date.now() + Math.max(1, Math.min(expiresDays, 60)) * 86400000).toISOString(),
      created_by: DEMO_ADMIN.email,
      created_at: new Date().toISOString(),
    };
    writeStore(KEYS.signing, [...readStore(KEYS.signing, []), record]);
    return { id: record.id, token: record.token, code, expires_at: record.expires_at };
  },

  async regenerateSigningCode(id) {
    const items = readStore(KEYS.signing, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("not_found");
    if (items[idx].status !== "pendiente") throw new Error("not_pending");
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    items[idx] = { ...items[idx], code, failed_attempts: 0 };
    writeStore(KEYS.signing, items);
    return { code };
  },

  async updateSigningRequest(id, fields) {
    const items = readStore(KEYS.signing, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("not_found");
    items[idx] = { ...items[idx], ...fields };
    writeStore(KEYS.signing, items);
  },

  async deleteSigningRequest(id) {
    writeStore(KEYS.signing, readStore(KEYS.signing, []).filter((r) => r.id !== id));
  },

  async signingInfo(token) {
    const r = readStore(KEYS.signing, []).find((x) => x.token === token);
    if (!r) return null;
    let status = r.status;
    if (status === "pendiente" && new Date(r.expires_at) < new Date()) status = "expirado";
    else if (status === "pendiente" && r.failed_attempts >= 5) status = "bloqueado";
    return { title: r.title, status };
  },

  // Devuelve null si todo está bien o el error (mismos textos que la base).
  _signingCheck(items, token, code) {
    const idx = items.findIndex((x) => x.token === token);
    if (idx === -1) return { idx, error: "not_found" };
    const r = items[idx];
    if (r.status !== "pendiente") return { idx, error: "not_pending" };
    if (new Date(r.expires_at) < new Date()) return { idx, error: "expired" };
    if (r.failed_attempts >= 5) return { idx, error: "locked" };
    if (r.code !== code) {
      items[idx] = { ...r, failed_attempts: r.failed_attempts + 1 };
      return { idx, error: "invalid_code" };
    }
    return { idx, error: null };
  },

  async signingOpen(token, code) {
    const items = readStore(KEYS.signing, []);
    const { idx, error } = this._signingCheck(items, token, code);
    writeStore(KEYS.signing, items);
    if (error) return { error };
    const r = items[idx];
    return { title: r.title, signer_name: r.signer_name, document_b64: r.document_b64, doc_sha256: r.doc_sha256 };
  },

  async signingSubmit(token, code, signedName, signatureB64) {
    const items = readStore(KEYS.signing, []);
    const { idx, error } = this._signingCheck(items, token, code);
    if (error) {
      writeStore(KEYS.signing, items);
      return { error };
    }
    if (!String(signedName || "").trim()) return { error: "name_required" };
    if (!signatureB64 || signatureB64.length > 600000 || !signatureB64.startsWith("iVBOR")) return { error: "bad_signature" };
    items[idx] = {
      ...items[idx],
      status: "firmado",
      signed_at: new Date().toISOString(),
      signed_name: signedName.trim(),
      signature_b64: signatureB64,
      signer_ip: "demo",
      signer_agent: navigator.userAgent.slice(0, 300),
    };
    writeStore(KEYS.signing, items);
    return { signed_at: items[idx].signed_at, ip: "demo" };
  },

  // Registro de actividad: en modo demo no hay base ni triggers, así que no hay registro.
  async getAuditLog() {
    return [];
  },

  // Prospectos por etapas (modo demo: localStorage, sin RLS).
  async getProspects() {
    return readStore(KEYS.prospects, []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async getProspectById(id) {
    return readStore(KEYS.prospects, []).find((p) => p.id === id) || null;
  },

  // Alertas de propiedades (modo demo): mismas reglas que alert_subscribe en la base.
  async subscribeAlert({ kind, name, phone, contactMethod, email, criteria, propertyId }) {
    if (!["search", "price"].includes(kind)) return { error: "bad_kind" };
    const method = contactMethod === "email" ? "email" : "whatsapp";
    if (!String(name || "").trim() || String(name).length > 80) return { error: "name_required" };

    let normalized = null;
    let normalizedEmail = null;
    if (method === "whatsapp") {
      const digits = String(phone || "").replace(/\D/g, "");
      if (digits.length === 10) normalized = `52${digits}`;
      else if (digits.length === 12 && digits.startsWith("52")) normalized = digits;
      else if (digits.length === 13 && digits.startsWith("521")) normalized = `52${digits.slice(3)}`;
      else return { error: "bad_phone" };
    } else {
      normalizedEmail = String(email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 180) return { error: "bad_email" };
    }
    const crit = criteria && typeof criteria === "object" && !Array.isArray(criteria) ? criteria : null;
    if (!crit || JSON.stringify(crit).length > 1500) return { error: "bad_criteria" };

    let property = null;
    if (kind === "price") {
      property = await this.getPropertyById(propertyId);
      if (!property || property.active === false || property.status !== "disponible") return { error: "property_unavailable" };
    }
    const items = readStore(KEYS.alerts, []);
    const sameContact = (a) => (method === "whatsapp" ? a.phone === normalized : a.email === normalizedEmail);
    const same = (a) => a.active && a.contact_method === method && sameContact(a) && a.kind === kind && (kind === "price" ? a.property_id === propertyId : JSON.stringify(a.criteria) === JSON.stringify(crit));
    if (items.some(same)) return { ok: true, duplicate: true };
    if (items.filter((a) => a.active && a.contact_method === method && sameContact(a)).length >= 5) return { error: "limit" };
    items.push({
      id: uid("alert"),
      kind,
      name: String(name).trim(),
      phone: normalized,
      email: normalizedEmail,
      contact_method: method,
      criteria: kind === "price" ? {} : crit,
      property_id: kind === "price" ? propertyId : null,
      price_at_subscribe: kind === "price" ? Number(property.price) : null,
      active: true,
      unsubscribe_token: Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""),
      created_at: new Date().toISOString(),
      last_notified_at: null,
    });
    writeStore(KEYS.alerts, items);
    return { ok: true };
  },

  async unsubscribeAlert(token) {
    const items = readStore(KEYS.alerts, []);
    const idx = items.findIndex((a) => a.unsubscribe_token === token);
    if (idx === -1) return { error: "not_found" };
    items[idx] = { ...items[idx], active: false };
    writeStore(KEYS.alerts, items);
    return { ok: true };
  },

  async getAlerts() {
    return readStore(KEYS.alerts, [])
      .map(({ unsubscribe_token, ...rest }) => rest)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async setAlertActive(id, active) {
    writeStore(KEYS.alerts, readStore(KEYS.alerts, []).map((a) => (a.id === id ? { ...a, active } : a)));
  },

  async deleteAlert(id) {
    writeStore(KEYS.alerts, readStore(KEYS.alerts, []).filter((a) => a.id !== id));
  },

  // Historial de etapas (modo demo): lo que en Supabase hace un trigger.
  _logProspectStage(prospectId, stage, at = new Date().toISOString()) {
    const stages = readStore(KEYS.prospectStages, []);
    stages.push({ prospecto_id: prospectId, stage, at });
    writeStore(KEYS.prospectStages, stages);
  },

  // Los prospectos anteriores al historial reciben una fila con su etapa actual.
  async getProspectStageHistory() {
    const stages = readStore(KEYS.prospectStages, []);
    const seen = new Set(stages.map((s) => s.prospecto_id));
    const backfill = readStore(KEYS.prospects, [])
      .filter((p) => !seen.has(p.id))
      .map((p) => ({ prospecto_id: p.id, stage: p.stage, at: p.stage === "nuevo" ? p.created_at : p.updated_at }));
    return [...stages, ...backfill].sort((a, b) => String(a.at).localeCompare(String(b.at)));
  },

  async addProspect(fields) {
    const items = readStore(KEYS.prospects, []);
    const now = new Date().toISOString();
    const record = { id: uid("prospect"), ...fields, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now };
    items.push(record);
    writeStore(KEYS.prospects, items);
    this._logProspectStage(record.id, record.stage, now);
    return record;
  },

  async addProspects(rows) {
    const items = readStore(KEYS.prospects, []);
    const now = new Date().toISOString();
    const records = rows.map((r) => ({ id: uid("prospect"), ...r, created_by: DEMO_ADMIN.email, created_at: now, updated_at: now }));
    writeStore(KEYS.prospects, [...items, ...records]);
    records.forEach((r) => this._logProspectStage(r.id, r.stage, now));
    return records;
  },

  async updateProspect(id, fields) {
    const items = readStore(KEYS.prospects, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Prospecto no encontrado");
    const previousStage = items[idx].stage;
    items[idx] = { ...items[idx], ...fields, updated_at: new Date().toISOString() };
    writeStore(KEYS.prospects, items);
    if (fields.stage && fields.stage !== previousStage) this._logProspectStage(id, fields.stage);
    return items[idx];
  },

  async deleteProspect(id) {
    writeStore(KEYS.prospects, readStore(KEYS.prospects, []).filter((p) => p.id !== id));
    writeStore(KEYS.prospectStages, readStore(KEYS.prospectStages, []).filter((s) => s.prospecto_id !== id));
  },

  // Historial de Estimación de valor (modo demo: localStorage).
  async getValuationEstimates() {
    return readStore(KEYS.valuations, []).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async addValuationEstimate(fields) {
    const items = readStore(KEYS.valuations, []);
    const record = { id: uid("valuation"), ...fields, created_by: DEMO_ADMIN.email, created_at: new Date().toISOString() };
    items.push(record);
    writeStore(KEYS.valuations, items);
    return record;
  },

  async deleteValuationEstimate(id) {
    writeStore(KEYS.valuations, readStore(KEYS.valuations, []).filter((r) => r.id !== id));
  },

  // Mercado en internet (modo demo): no hay función de Vercel ni llave de
  // Claude, así que se generan anuncios de EJEMPLO (src/lib/marketDemo.js),
  // marcados como tales. Mismo contrato que supabaseBackend, incluida la
  // caché de 24 h para que el flujo "reusar / actualizar" se pueda probar.
  async requestMarketComps({ zone, municipality, propertyType, builtArea, force }) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const items = readStore(KEYS.marketSnapshots, []);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const recent = items
      .filter((s) => s.zone_name.toLowerCase() === zone.toLowerCase() && s.municipality === municipality && s.property_type === propertyType && new Date(s.created_at).getTime() >= since)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (recent && !force) return { configured: true, cached: true, snapshot: recent };

    const snapshot = { id: uid("market"), ...buildDemoSnapshot({ zone, municipality, propertyType, builtArea }), created_at: new Date().toISOString() };
    items.push(snapshot);
    writeStore(KEYS.marketSnapshots, items);
    return { configured: true, cached: false, saved: true, snapshot };
  },

  async getMarketSnapshots(zoneName) {
    const wanted = zoneName ? String(zoneName).toLowerCase() : null;
    return readStore(KEYS.marketSnapshots, [])
      .filter((s) => !wanted || s.zone_name.toLowerCase() === wanted)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 30);
  },

  async deleteMarketSnapshot(id) {
    writeStore(KEYS.marketSnapshots, readStore(KEYS.marketSnapshots, []).filter((s) => s.id !== id));
  },

  // Bitácoras de Secretaría: control de llaves y entradas/salidas de
  // documentos (modo demo: localStorage, sin RLS).
  async getSecretariaLog(kind) {
    return readStore(kind === "keys" ? KEYS.keyLog : KEYS.docLog, [])
      .sort((a, b) => String(b.logged_at).localeCompare(String(a.logged_at)));
  },

  async addSecretariaLog(kind, fields) {
    const key = kind === "keys" ? KEYS.keyLog : KEYS.docLog;
    const items = readStore(key, []);
    const record = { id: uid(kind), ...fields, created_by: DEMO_ADMIN.email, created_at: new Date().toISOString() };
    items.push(record);
    writeStore(key, items);
    return record;
  },

  async updateSecretariaLog(kind, id, fields) {
    const key = kind === "keys" ? KEYS.keyLog : KEYS.docLog;
    const items = readStore(key, []);
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Registro no encontrado");
    items[idx] = { ...items[idx], ...fields };
    writeStore(key, items);
    return items[idx];
  },

  async deleteSecretariaLog(kind, id) {
    const key = kind === "keys" ? KEYS.keyLog : KEYS.docLog;
    writeStore(key, readStore(key, []).filter((r) => r.id !== id));
  },

  // Replica en JS lo que en Supabase hace _visit_report_payload (schema.sql):
  // una lista CERRADA de campos por visita — sin nombre del prospecto, sin
  // asesor, sin notas internas. Lo usan tanto la vista previa del personal como
  // la página pública por token.
  _visitReportPayload(propertyId) {
    const property = readStore(KEYS.properties, PROPERTIES).find((p) => p.id === propertyId);
    if (!property) return null;
    const sale = property.status === "vendida" ? readStore(KEYS.ventas, VENTAS_SEED).find((v) => v.property_id === propertyId) : null;
    return {
      property: {
        title: property.title,
        code: property.code || null,
        zone: property.zone,
        status: property.status,
        created_at: property.created_at || null,
        main_image: property.main_image || null,
      },
      sold_on: sale?.fecha_venta || null,
      visits: readStore(KEYS.visits, VISITS_SEED)
        .filter((v) => v.property_id === propertyId)
        .sort((a, b) => String(b.visited_at).localeCompare(String(a.visited_at)))
        .map((v) => ({
          visited_at: v.visited_at,
          interest: v.interest,
          reasons: v.reasons || [],
          comments: v.comments?.trim() || null,
        })),
    };
  },

  async getVisitReport(propertyId) {
    return this._visitReportPayload(propertyId);
  },

  async getReportLink(propertyId) {
    return readStore(KEYS.reportLinks, []).find((l) => l.property_id === propertyId) || null;
  },

  // Crea el enlace o lo REGENERA (el token anterior deja de funcionar).
  async saveReportLink(propertyId) {
    const links = readStore(KEYS.reportLinks, []);
    const record = { property_id: propertyId, token: generateReportToken(), created_by: DEMO_ADMIN.email, created_at: new Date().toISOString() };
    const idx = links.findIndex((l) => l.property_id === propertyId);
    if (idx === -1) links.push(record);
    else links[idx] = record;
    writeStore(KEYS.reportLinks, links);
    return record;
  },

  async deleteReportLink(propertyId) {
    writeStore(KEYS.reportLinks, readStore(KEYS.reportLinks, []).filter((l) => l.property_id !== propertyId));
  },

  // Igual que en Supabase: null si el token no existe, fue regenerado o se
  // desactivó (y ni siquiera se busca si no tiene el formato de un token).
  async getVisitReportByToken(token) {
    if (!REPORT_TOKEN_PATTERN.test(token || "")) return null;
    const link = readStore(KEYS.reportLinks, []).find((l) => l.token === token);
    return link ? this._visitReportPayload(link.property_id) : null;
  },

  async getRoles() {
    return readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
  },

  async addRole({ name, sections }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (roles.some((r) => r.slug === slug)) {
      throw new Error("Ya existe un rol con ese nombre");
    }
    const record = { id: uid("role"), slug, name: trimmed, sections: sections || [] };
    roles.push(record);
    writeStore(KEYS.adminRoles, roles);
    return record;
  },

  async updateRole(id, { name, sections }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const idx = roles.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Rol no encontrado");
    const trimmed = name.trim();
    const slug = slugify(trimmed);
    if (roles.some((r) => r.id !== id && r.slug === slug)) throw new Error("Ya existe un rol con ese nombre");
    roles[idx] = { ...roles[idx], slug, name: trimmed, sections: sections || [] };
    writeStore(KEYS.adminRoles, roles);
    return roles[idx];
  },

  async deleteRole(id) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    if (access.some((a) => a.role_id === id)) {
      throw new Error("Este rol tiene correos asignados; quítales el acceso antes de borrarlo");
    }
    writeStore(KEYS.adminRoles, roles.filter((r) => r.id !== id));
  },

  async getAccess() {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    return access.map((a) => ({ ...a, role: roles.find((r) => r.id === a.role_id) || null }));
  },

  async getMyAccess(email) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const found = access.find((a) => a.email === email.toLowerCase());
    if (!found) return null;
    return { ...found, role: roles.find((r) => r.id === found.role_id) || null };
  },

  async addAccess({ email, role_id, advisor_id }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const normalized = email.trim().toLowerCase();
    if (access.some((a) => a.email === normalized)) {
      throw new Error("Ese correo ya tiene acceso asignado");
    }
    const record = { id: uid("access"), email: normalized, role_id, advisor_id: advisor_id || null };
    access.push(record);
    writeStore(KEYS.adminAccess, access);
    return { ...record, role: roles.find((r) => r.id === role_id) || null };
  },

  async updateAccess(id, { role_id, advisor_id } = {}) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const idx = access.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Acceso no encontrado");
    const patch = {};
    if (role_id !== undefined) patch.role_id = role_id;
    if (advisor_id !== undefined) patch.advisor_id = advisor_id || null;
    access[idx] = { ...access[idx], ...patch };
    writeStore(KEYS.adminAccess, access);
    return { ...access[idx], role: roles.find((r) => r.id === access[idx].role_id) || null };
  },

  async deleteAccess(id) {
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    writeStore(KEYS.adminAccess, access.filter((a) => a.id !== id));
  },

  async getAgendaCitas() {
    const citas = readStore(KEYS.agendaCitas, []);
    return [...citas].sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
  },

  async getAgendaCitaById(id) {
    const citas = readStore(KEYS.agendaCitas, []);
    return citas.find((c) => c.id === id) || null;
  },

  async addAgendaCita({ advisor_id, client_id, titulo, fecha, hora, actividades }) {
    const citas = readStore(KEYS.agendaCitas, []);
    const record = {
      id: uid("cita"),
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    citas.push(record);
    writeStore(KEYS.agendaCitas, citas);
    return record;
  },

  async updateAgendaCita(id, { advisor_id, client_id, titulo, fecha, hora, actividades }) {
    const citas = readStore(KEYS.agendaCitas, []);
    const idx = citas.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("Cita no encontrada");
    citas[idx] = {
      ...citas[idx],
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.agendaCitas, citas);
    return citas[idx];
  },

  async deleteAgendaCita(id) {
    const citas = readStore(KEYS.agendaCitas, []);
    writeStore(KEYS.agendaCitas, citas.filter((c) => c.id !== id));
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    writeStore(KEYS.agendaExpedientes, expedientes.filter((e) => e.cita_id !== id));
  },

  async getAgendaExpedientes(citaId) {
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    return expedientes
      .filter((e) => e.cita_id === citaId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((e) => ({ ...e, signed_url: e.file_path }));
  },

  async addAgendaExpediente({ cita_id, file }) {
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    const [dataUrl] = await filesToDataUrls([file]);
    const record = { id: uid("expediente"), cita_id, file_path: dataUrl, file_name: file.name, created_at: new Date().toISOString() };
    expedientes.push(record);
    writeStore(KEYS.agendaExpedientes, expedientes);
    return record;
  },

  async deleteAgendaExpediente(id) {
    const expedientes = readStore(KEYS.agendaExpedientes, []);
    writeStore(KEYS.agendaExpedientes, expedientes.filter((e) => e.id !== id));
  },

  async signIn(email, password) {
    if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
      const session = { user: { email } };
      writeStore(KEYS.session, session);
      notifyAuthListeners();
      return session;
    }
    throw new Error("invalid_credentials");
  },

  async signOut() {
    window.localStorage.removeItem(KEYS.session);
    notifyAuthListeners();
  },

  getCurrentSession() {
    return getSession();
  },

  onAuthStateChange(callback) {
    authListeners.add(callback);
    return () => authListeners.delete(callback);
  },

  // Construcción no tiene paridad en modo demo a propósito (geometría 2D/3D
  // no vale la pena replicar sobre localStorage) — las páginas de ese
  // apartado chequean useAuth().isDemoMode y nunca llegan a llamar esto; estos
  // stubs solo existen para que `db` (unión de supabaseBackend/localBackend)
  // tipe correctamente bajo TypeScript.
  async getConstruccionProyectos() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async getConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async addConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async pushConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async deleteConstruccionProyecto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async getConstruccionCatalogo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async pushConstruccionCatalogo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async getConstruccionFotos() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async addConstruccionFoto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async updateConstruccionFotoNota() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async deleteConstruccionFoto() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async deleteConstruccionFotosDeHabitacion() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async getConstruccionFondos() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async upsertConstruccionFondo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async updateConstruccionFondo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async deleteConstruccionFondo() {
    throw new Error("Construcción no está disponible en modo demo.");
  },
  async requestSketchToPlan() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  demoCredentials: DEMO_ADMIN,
};

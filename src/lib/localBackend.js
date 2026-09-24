import { ZONES, ADVISORS, PROPERTIES, VENTAS_SEED, VISITS_SEED, PROPERTY_TYPES_SEED, AMENITIES_SEED, DEMO_ADMIN, ADMIN_ROLES_SEED, ADMIN_ACCESS_SEED } from "./seedData";
import { generateReportToken, REPORT_TOKEN_PATTERN } from "./visitReport";
import { PERFILAMIENTO_VENDEDOR_LIST_FIELDS } from "./perfilamientoVendedor";
import { PERFILAMIENTO_COMPRADOR_LIST_FIELDS } from "./perfilamientoComprador";
import { slugify, numOrNull } from "./format";
import { CLIENT_EXPEDIENTE_KEYS } from "./clientExpedienteFields";
import { compressImageFile, compressImageFiles } from "./imageCompression";

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
  keyLog: "acl_local_key_log",
  docLog: "acl_local_doc_log",
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
};

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
  },

  async getClientDocuments(clientId) {
    const docs = readStore(KEYS.clientDocuments, []);
    return docs
      .filter((d) => d.client_id === clientId)
      .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))
      .map((d) => ({ ...d, signed_url: d.file_path }));
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

  demoCredentials: DEMO_ADMIN,
};

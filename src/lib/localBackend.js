import { ZONES, ADVISORS, PROPERTIES, PROPERTY_TYPES_SEED, DEMO_ADMIN, ADMIN_ROLES_SEED, ADMIN_ACCESS_SEED } from "./seedData";
import { PERFILAMIENTO_VENDEDOR_LIST_FIELDS } from "./perfilamientoVendedor";
import { PERFILAMIENTO_COMPRADOR_LIST_FIELDS } from "./perfilamientoComprador";
import { slugify, numOrNull } from "./format";

const KEYS = {
  properties: "acl_local_properties",
  advisors: "acl_local_advisors",
  zones: "acl_local_zones",
  propertyTypes: "acl_local_property_types",
  session: "acl_local_session",
  clients: "acl_local_clients",
  clientDocuments: "acl_local_client_documents",
  remodelProjects: "acl_local_remodel_projects",
  remodelProgress: "acl_local_remodel_progress",
  materialsCatalog: "acl_local_materials_catalog",
  perfilamientosVendedor: "acl_local_perfilamientos",
  perfilamientosComprador: "acl_local_perfilamientos_comprador",
  liquidaciones: "acl_local_liquidaciones",
  adminRoles: "acl_local_admin_roles",
  adminAccess: "acl_local_admin_access",
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

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  if (filters.zone && property.zone !== filters.zone) return false;
  if (filters.minPrice != null && property.price < filters.minPrice) return false;
  if (filters.maxPrice != null && property.price > filters.maxPrice) return false;
  if (filters.minArea != null && property.area_m2 < filters.minArea) return false;
  if (filters.maxArea != null && property.area_m2 > filters.maxArea) return false;
  return true;
}

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
    return properties.filter((p) => matchesFilters(p, filters)).map((p) => withAdvisors(p, advisors));
  },

  async getPropertyById(id) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const found = properties.find((p) => p.id === id);
    return found ? withAdvisors(found, advisors) : null;
  },

  async addProperty(data) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const newImages = await filesToDataUrls(data.imageFiles);
    const images = [...(data.existingImages || []), ...newImages];
    const record = {
      id: uid("prop"),
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
    };
    properties.push(record);
    writeStore(KEYS.properties, properties);
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
    const newImages = await filesToDataUrls(data.imageFiles);
    const images = [...(data.existingImages || []), ...newImages];
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
    };
    properties[idx] = updated;
    writeStore(KEYS.properties, properties);
    return updated;
  },

  async deleteProperty(id) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    writeStore(
      KEYS.properties,
      properties.filter((p) => p.id !== id)
    );
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
    if (data.photoFile) photo_url = await fileToDataUrl(data.photoFile);
    const record = {
      id: uid("advisor"),
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsapp: data.whatsapp,
      bio: data.bio,
      photo_url,
      active: data.active !== false,
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
    if (data.photoFile) photo_url = await fileToDataUrl(data.photoFile);
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
    const record = { id: uid("zone"), name, price_per_m2: Number(data.price_per_m2) || 0 };
    zones.push(record);
    writeStore(KEYS.zones, zones);
    return record;
  },

  async deleteZone(id) {
    const zones = readStore(KEYS.zones, ZONES);
    writeStore(KEYS.zones, zones.filter((z) => z.id !== id));
  },

  async updateZonePrice(id, price_per_m2) {
    const zones = readStore(KEYS.zones, ZONES);
    const idx = zones.findIndex((z) => z.id === id);
    if (idx === -1) throw new Error("Zona no encontrada");
    zones[idx] = { ...zones[idx], price_per_m2: Number(price_per_m2) };
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

  async submitContactMessage(data) {
    const key = "acl_local_messages";
    const messages = readStore(key, []);
    messages.push({ id: uid("msg"), ...data, created_at: new Date().toISOString() });
    writeStore(key, messages);
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
    roles[idx] = { ...roles[idx], name: name.trim(), sections: sections || [] };
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

  async addAccess({ email, role_id }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const normalized = email.trim().toLowerCase();
    if (access.some((a) => a.email === normalized)) {
      throw new Error("Ese correo ya tiene acceso asignado");
    }
    const record = { id: uid("access"), email: normalized, role_id };
    access.push(record);
    writeStore(KEYS.adminAccess, access);
    return { ...record, role: roles.find((r) => r.id === role_id) || null };
  },

  async updateAccess(id, { role_id }) {
    const roles = readStore(KEYS.adminRoles, ADMIN_ROLES_SEED);
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    const idx = access.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error("Acceso no encontrado");
    access[idx] = { ...access[idx], role_id };
    writeStore(KEYS.adminAccess, access);
    return { ...access[idx], role: roles.find((r) => r.id === role_id) || null };
  },

  async deleteAccess(id) {
    const access = readStore(KEYS.adminAccess, ADMIN_ACCESS_SEED);
    writeStore(KEYS.adminAccess, access.filter((a) => a.id !== id));
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

  demoCredentials: DEMO_ADMIN,
};

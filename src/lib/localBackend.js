import { ZONES, ADVISORS, PROPERTIES, DEMO_ADMIN } from "./seedData";
import { toPerfilamientoPayload, PERFILAMIENTO_LIST_FIELDS } from "./perfilamiento";

const KEYS = {
  properties: "acl_local_properties",
  advisors: "acl_local_advisors",
  zones: "acl_local_zones",
  session: "acl_local_session",
  clients: "acl_local_clients",
  clientDocuments: "acl_local_client_documents",
  remodelProjects: "acl_local_remodel_projects",
  materialsCatalog: "acl_local_materials_catalog",
  perfilamientos: "acl_local_perfilamientos",
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
      active: data.active !== false,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      advisor_ids: data.advisor_ids || [],
    };
    properties.push(record);
    writeStore(KEYS.properties, properties);
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
      active: data.active,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      advisor_ids: data.advisor_ids || [],
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

  async updateZonePrice(id, price_per_m2) {
    const zones = readStore(KEYS.zones, ZONES);
    const idx = zones.findIndex((z) => z.id === id);
    if (idx === -1) throw new Error("Zona no encontrada");
    zones[idx] = { ...zones[idx], price_per_m2: Number(price_per_m2) };
    writeStore(KEYS.zones, zones);
    return zones[idx];
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

  async addRemodelProject(data) {
    const projects = readStore(KEYS.remodelProjects, []);
    const record = {
      id: uid("remodel"),
      name: data.name,
      client_id: data.client_id || null,
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
  async getPerfilamientos(clienteId) {
    const items = readStore(KEYS.perfilamientos, []);
    return items
      .filter((p) => p.cliente_id === clienteId)
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .map((p) => Object.fromEntries(PERFILAMIENTO_LIST_FIELDS.map((key) => [key, p[key]])));
  },

  async getPerfilamientoById(id) {
    const items = readStore(KEYS.perfilamientos, []);
    return items.find((p) => p.id === id) || null;
  },

  async addPerfilamiento(clienteId, form) {
    const items = readStore(KEYS.perfilamientos, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("perf"),
      cliente_id: clienteId,
      ...toPerfilamientoPayload(form),
      usuario_creo: DEMO_ADMIN.email,
      fecha_creacion: now,
      fecha_modificacion: now,
    };
    items.push(record);
    writeStore(KEYS.perfilamientos, items);
    return record;
  },

  async updatePerfilamiento(id, form) {
    const items = readStore(KEYS.perfilamientos, []);
    const idx = items.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Perfilamiento no encontrado");
    const updated = {
      ...items[idx],
      ...toPerfilamientoPayload(form),
      fecha_modificacion: new Date().toISOString(),
    };
    items[idx] = updated;
    writeStore(KEYS.perfilamientos, items);
    return updated;
  },

  async deletePerfilamiento(id) {
    const items = readStore(KEYS.perfilamientos, []);
    writeStore(KEYS.perfilamientos, items.filter((p) => p.id !== id));
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

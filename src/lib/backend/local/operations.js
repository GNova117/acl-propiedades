// Backend de modo demo (localStorage): métodos de «operations» (50). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { DEMO_ADMIN } from "../../seedData";
import { compressImageFile } from "../../imageCompression";
import { buildDemoSnapshot } from "../../marketDemo";
import { KEYS, readStore, writeStore, FILE_QUOTA_MESSAGE, writeStoreOrThrowFriendly, uid, fileToDataUrl, filesToDataUrls } from "./shared.js";
import { materialFields, laborFields } from "../../backendRules";

export const operationsMethods = {
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
      ...materialFields(data),
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
      ...materialFields(data),
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
      ...laborFields(data),
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

  async requestSketchToPlan() {
    throw new Error("Construcción no está disponible en modo demo.");
  },

  // Sin Supabase no hay función serverless: el modo demo deja el texto de plantilla.
  async requestAdCopy() {
    const err = new Error("demo");
    err.code = "demo";
    throw err;
  },
};

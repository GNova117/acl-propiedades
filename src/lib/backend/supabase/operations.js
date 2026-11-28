// Backend con Supabase: métodos de «operations» (50). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { compressImageFile } from "../../imageCompression";
import { sanitizeFileName, discardUploads, SECRETARIA_TABLES, signInspectionChecklist, uploadInspectionChecklistPhotos } from "./shared.js";
import { materialFields, laborFields } from "../../backendRules";

export const operationsMethods = {
  async getRemodelProjects(filters = {}) {
    let query = supabase.from("remodel_projects").select("*").order("created_at", { ascending: false });
    if (filters.client_id) query = query.eq("client_id", filters.client_id);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getRemodelProjectById(id) {
    const { data, error } = await supabase.from("remodel_projects").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // El proyecto que se creó automáticamente al dar de alta la propiedad
  // (ver addProperty). Alimenta "Inversión — costo de remodelación" en
  // Liquidación.
  async getRemodelProjectByProperty(propertyId) {
    const { data, error } = await supabase.from("remodel_projects").select("*").eq("property_id", propertyId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addRemodelProject(data) {
    const payload = {
      name: data.name,
      client_id: data.client_id || null,
      property_id: data.property_id || null,
      area_m2: Number(data.area_m2),
      notes: data.notes || null,
      materials: data.materials || [],
      spaces: data.spaces || [],
    };
    const { data: inserted, error } = await supabase.from("remodel_projects").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateRemodelProject(id, data) {
    const payload = {
      name: data.name,
      client_id: data.client_id || null,
      area_m2: Number(data.area_m2),
      notes: data.notes || null,
      materials: data.materials || [],
      spaces: data.spaces || [],
      updated_at: new Date().toISOString(),
    };
    const { data: updated, error } = await supabase.from("remodel_projects").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteRemodelProject(id) {
    const { error } = await supabase.from("remodel_projects").delete().eq("id", id);
    if (error) throw error;
  },

  async getRemodelProgress(remodelProjectId) {
    const { data, error } = await supabase
      .from("remodel_progress_entries")
      .select("*")
      .eq("remodel_project_id", remodelProjectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const paths = data.map((d) => d.file_path);
    const { data: signed } = await supabase.storage.from("remodel-progress").createSignedUrls(paths, 300);
    return data.map((entry, i) => ({ ...entry, signed_url: signed?.[i]?.signedUrl || null }));
  },

  async addRemodelProgress({ remodel_project_id, entry_type, blob, note }) {
    const ext = (blob.name?.split(".").pop() || "jpg").toLowerCase();
    const path = `${remodel_project_id}/${entry_type}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("remodel-progress")
      .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("remodel_progress_entries")
      .insert({ remodel_project_id, entry_type, file_path: path, note: note || null })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteRemodelProgress(id) {
    const { data: entry } = await supabase.from("remodel_progress_entries").select("file_path").eq("id", id).maybeSingle();
    if (entry?.file_path) {
      await supabase.storage.from("remodel-progress").remove([entry.file_path]);
    }
    const { error } = await supabase.from("remodel_progress_entries").delete().eq("id", id);
    if (error) throw error;
  },

  async getMaterialsCatalog(filters = {}) {
    let query = supabase.from("materials_catalog").select("*").order("name");
    if (filters.activeOnly) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getMaterialCatalogItemById(id) {
    const { data, error } = await supabase.from("materials_catalog").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addMaterialCatalogItem(data) {
    const payload = materialFields(data);
    const { data: inserted, error } = await supabase.from("materials_catalog").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateMaterialCatalogItem(id, data) {
    const payload = { ...materialFields(data), updated_at: new Date().toISOString() };
    const { data: updated, error } = await supabase.from("materials_catalog").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteMaterialCatalogItem(id) {
    const { error } = await supabase.from("materials_catalog").delete().eq("id", id);
    if (error) throw error;
  },

  async getLaborCatalog() {
    const { data, error } = await supabase.from("labor_catalog").select("*").order("concepto");
    if (error) throw error;
    return data || [];
  },

  async addLaborCatalogItem(data) {
    const payload = laborFields(data);
    const { data: inserted, error } = await supabase.from("labor_catalog").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateLaborPrice(id, precio_unitario) {
    const { data, error } = await supabase
      .from("labor_catalog")
      .update({ precio_unitario: Number(precio_unitario), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteLaborCatalogItem(id) {
    const { error } = await supabase.from("labor_catalog").delete().eq("id", id);
    if (error) throw error;
  },

  // Bitácora y gastos por propiedad. Tablas property_log / property_budgets y
  // bucket privado property-log-files, todos protegidos por RLS con
  // has_admin_section('bitacora') (ver schema.sql): quien no tenga ese
  // apartado recibe 0 filas, no un error.
  async getPropertyLog(propertyId) {
    const { data, error } = await supabase
      .from("property_log")
      .select("*")
      .eq("property_id", propertyId)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    const entries = data || [];
    const withFile = entries.filter((e) => e.file_path);
    if (withFile.length === 0) return entries;
    // 1 h, no los 5 min de los expedientes: la pantalla puede quedarse abierta
    // un rato mientras se capturan varios gastos y las miniaturas no deben
    // romperse a la mitad.
    const { data: signed } = await supabase.storage
      .from("property-log-files")
      .createSignedUrls(withFile.map((e) => e.file_path), 3600);
    const urlByPath = new Map(withFile.map((e, i) => [e.file_path, signed?.[i]?.signedUrl || null]));
    return entries.map((e) => ({ ...e, signed_url: e.file_path ? urlByPath.get(e.file_path) : null }));
  },

  // Solo los gastos, sin URLs firmadas: lo usan la Utilidad de una casa y el
  // reporte de Ganancias (todas las casas cuando no se pasa propertyId).
  async getExpenses(propertyId = null) {
    let query = supabase.from("property_log").select("id, property_id, entry_date, categoria, monto").eq("kind", "gasto");
    if (propertyId) query = query.eq("property_id", propertyId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async addPropertyLogEntry({ property_id, file, ...fields }) {
    const { data: sessionData } = await supabase.auth.getSession();
    let uploaded = null;
    if (file) {
      const prepared = await compressImageFile(file);
      const path = `${property_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(prepared.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("property-log-files")
        .upload(path, prepared, { contentType: prepared.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      uploaded = { path, name: file.name, type: prepared.type || file.type || null };
    }
    const row = {
      ...fields,
      property_id,
      file_path: uploaded?.path || null,
      file_name: uploaded?.name || null,
      file_type: uploaded?.type || null,
      created_by: sessionData?.session?.user?.email || null,
    };
    const { data, error } = await supabase.from("property_log").insert(row).select().single();
    if (error) {
      // El archivo ya estaba arriba pero la fila no se guardó: no dejarlo huérfano.
      if (uploaded) await discardUploads([{ bucket: "property-log-files", path: uploaded.path }]);
      throw error;
    }
    return data;
  },

  // Edita solo los campos de texto/monto/fecha. Para cambiar el comprobante se
  // borra la entrada y se vuelve a capturar — así nunca hay un archivo
  // reemplazado a medias entre Storage y la fila.
  async updatePropertyLogEntry(id, fields) {
    const { data, error } = await supabase.from("property_log").update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePropertyLogEntry(id) {
    const { data: entry } = await supabase.from("property_log").select("file_path").eq("id", id).maybeSingle();
    const { error } = await supabase.from("property_log").delete().eq("id", id);
    if (error) throw error;
    if (entry?.file_path) await supabase.storage.from("property-log-files").remove([entry.file_path]);
  },

  async getPropertyBudget(propertyId) {
    const { data, error } = await supabase.from("property_budgets").select("monto").eq("property_id", propertyId).maybeSingle();
    if (error) throw error;
    return data ? Number(data.monto) : null;
  },

  async savePropertyBudget(propertyId, monto) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      property_id: propertyId,
      monto: Number(monto) || 0,
      usuario_actualizo: sessionData?.session?.user?.email || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("property_budgets").upsert(row, { onConflict: "property_id" });
    if (error) throw error;
    return row.monto;
  },

  // Cotejo de inspección previo a avalúo. El checklist completo vive en una
  // sola columna jsonb (property_inspections.checklist); cada fila trae a lo
  // más una foto, subida a inspection-photos bajo `${inspectionId}/...`. Se
  // firma (createSignedUrls) solo al leer un registro puntual — la lista no
  // necesita ver las fotos, así que ahí no se paga ese costo.
  async getInspections() {
    const { data, error } = await supabase.from("property_inspections").select("*").order("visited_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getInspectionById(id) {
    const { data, error } = await supabase.from("property_inspections").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { ...data, checklist: await signInspectionChecklist(data.checklist) };
  },

  async addInspection({ id, checklist, ...fields }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const preparedChecklist = await uploadInspectionChecklistPhotos(id, checklist);
    const row = { id, ...fields, checklist: preparedChecklist, created_by: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("property_inspections").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateInspection(id, { checklist, ...fields }) {
    const preparedChecklist = await uploadInspectionChecklistPhotos(id, checklist);
    const { data, error } = await supabase
      .from("property_inspections")
      .update({ ...fields, checklist: preparedChecklist, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteInspection(id) {
    const { data: existing } = await supabase.from("property_inspections").select("checklist").eq("id", id).maybeSingle();
    const paths = (existing?.checklist || []).filter((e) => e.file_path).map((e) => e.file_path);
    if (paths.length) await supabase.storage.from("inspection-photos").remove(paths);
    const { error } = await supabase.from("property_inspections").delete().eq("id", id);
    if (error) throw error;
  },

  // Rubros del desglose de gastos por municipio y perfil (expense_concepts).
  async getExpenseConcepts() {
    const { data, error } = await supabase.from("expense_concepts").select("*").order("sort_order").order("name");
    if (error) throw error;
    return data || [];
  },

  async saveExpenseConcept(fields, id = null) {
    const query = id
      ? supabase.from("expense_concepts").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id)
      : supabase.from("expense_concepts").insert(fields);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async addExpenseConcepts(rows) {
    const { data, error } = await supabase.from("expense_concepts").insert(rows).select();
    if (error) throw error;
    return data || [];
  },

  async deleteExpenseConcept(id) {
    const { error } = await supabase.from("expense_concepts").delete().eq("id", id);
    if (error) throw error;
  },

  // Historial exacto de gastos por casa (expense_reports/expense_report_items).
  // Cada registro es una copia congelada: si después cambia la tarifa de un
  // rubro en expense_concepts, este registro no se toca.
  async getExpenseReports({ propertyId, houseName } = {}) {
    let query = supabase.from("expense_reports").select("*, items:expense_report_items(*)").order("created_at", { ascending: false });
    if (propertyId) query = query.eq("property_id", propertyId);
    if (houseName) query = query.ilike("house_name", houseName);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((r) => ({ ...r, items: (r.items || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) }));
  },

  async saveExpenseReport({ items, ...fields }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const { data: report, error } = await supabase
      .from("expense_reports")
      .insert({ ...fields, created_by: sessionData?.session?.user?.email || null })
      .select()
      .single();
    if (error) throw error;
    if (items?.length) {
      const { error: itemsError } = await supabase.from("expense_report_items").insert(items.map((it) => ({ ...it, report_id: report.id })));
      if (itemsError) throw itemsError;
    }
    return { ...report, items: items || [] };
  },

  async deleteExpenseReport(id) {
    const { error } = await supabase.from("expense_reports").delete().eq("id", id);
    if (error) throw error;
  },

  // Modifica un registro ya guardado (por ejemplo, ajustar un monto o el precio
  // final una vez que se conoce). Reemplaza sus renglones por completo: es más
  // simple que hacer un update fino y el resultado es el mismo, un registro con
  // exactamente los renglones que se le pasan.
  async updateExpenseReport(id, { items, ...fields }) {
    const { data: report, error } = await supabase
      .from("expense_reports")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const { error: deleteError } = await supabase.from("expense_report_items").delete().eq("report_id", id);
    if (deleteError) throw deleteError;
    if (items?.length) {
      const { error: itemsError } = await supabase.from("expense_report_items").insert(items.map((it) => ({ ...it, report_id: id })));
      if (itemsError) throw itemsError;
    }
    return { ...report, items: items || [] };
  },

  // Historial de Estimación de valor. RLS: apartado 'valuacion' (ver schema.sql).
  async getValuationEstimates() {
    const { data, error } = await supabase.from("valuation_estimates").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addValuationEstimate(fields) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...fields, created_by: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("valuation_estimates").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async deleteValuationEstimate(id) {
    const { error } = await supabase.from("valuation_estimates").delete().eq("id", id);
    if (error) throw error;
  },

  // Mercado en internet. La consulta la hace la función de Vercel
  // api/market-comps (la llave de Claude vive solo allá) y ella misma guarda la
  // "foto" en market_snapshots; aquí solo se pide, se lista y se borra.
  // Los errores llevan `code` para que la pantalla explique qué pasó.
  async requestMarketComps(params) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      const err = new Error("unauthorized");
      err.code = "unauthorized";
      throw err;
    }
    const res = await fetch("/api/market-comps", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || body.error || `HTTP ${res.status}`);
      // 404 = no hay función (p. ej. `vite dev` contra Supabase real).
      err.code = res.status === 404 ? "no_function" : body.error || "upstream";
      err.limit = body.limit;
      throw err;
    }
    return body;
  },

  async requestSketchToPlan(params) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      const err = new Error("unauthorized");
      err.code = "unauthorized";
      throw err;
    }
    const res = await fetch("/api/sketch-to-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || body.error || `HTTP ${res.status}`);
      err.code = res.status === 404 ? "no_function" : body.error || "upstream";
      err.limit = body.limit;
      throw err;
    }
    return body;
  },

  // Textos de anuncio con Claude (api/ad-copy). Solo se manda el id de la
  // propiedad: la función lee los datos de la base. Errores con `code`
  // (limit, no_table, no_function…) para que la pantalla explique qué pasó.
  async requestAdCopy({ propertyId, channel, tone, extra, language }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      const err = new Error("unauthorized");
      err.code = "unauthorized";
      throw err;
    }
    const res = await fetch("/api/ad-copy", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ propertyId, channel, tone, extra, language }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body.message || body.error || `HTTP ${res.status}`);
      err.code = res.status === 404 && !body.error ? "no_function" : body.error || "upstream";
      err.limit = body.limit;
      err.scope = body.scope;
      throw err;
    }
    return body;
  },

  async getMarketSnapshots(zoneName) {
    let query = supabase.from("market_snapshots").select("*").order("created_at", { ascending: false }).limit(30);
    if (zoneName) query = query.ilike("zone_name", String(zoneName).replace(/[%_]/g, " "));
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async deleteMarketSnapshot(id) {
    const { error } = await supabase.from("market_snapshots").delete().eq("id", id);
    if (error) throw error;
  },

  // Bitácoras de Secretaría (llaves y documentos). RLS: solo quien tenga el
  // apartado 'secretaria' (ver schema.sql).
  async getSecretariaLog(kind) {
    const { data, error } = await supabase.from(SECRETARIA_TABLES[kind]).select("*").order("logged_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addSecretariaLog(kind, fields) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...fields, created_by: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from(SECRETARIA_TABLES[kind]).insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateSecretariaLog(kind, id, fields) {
    const { data, error } = await supabase.from(SECRETARIA_TABLES[kind]).update(fields).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteSecretariaLog(kind, id) {
    const { error } = await supabase.from(SECRETARIA_TABLES[kind]).delete().eq("id", id);
    if (error) throw error;
  },
};

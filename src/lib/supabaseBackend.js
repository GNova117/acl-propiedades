import { supabase } from "./supabaseClient";
import { PERFILAMIENTO_VENDEDOR_LIST_FIELDS } from "./perfilamientoVendedor";
import { PERFILAMIENTO_COMPRADOR_LIST_FIELDS } from "./perfilamientoComprador";
import { slugify, numOrNull } from "./format";

// Supabase Storage rechaza ciertos caracteres en la key del objeto (espacios,
// acentos, "{"/"}", etc. — el nombre real del archivo que sube el usuario no
// se puede meter tal cual en la ruta). Se sanitiza la base y se conserva la
// extensión real por separado, para no perder el tipo de archivo.
function sanitizeFileName(name) {
  const lastDot = name.lastIndexOf(".");
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : "";
  const safeBase =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "archivo";
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return safeExt ? `${safeBase}.${safeExt}` : safeBase;
}

async function uploadFiles(bucket, files) {
  if (!files || files.length === 0) return [];
  const urls = [];
  for (const file of Array.from(files)) {
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeFileName(file.name)}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

function mapPropertyRow(row) {
  return {
    ...row,
    advisor_ids: (row.property_advisors || []).map((pa) => pa.advisor_id),
    advisors: (row.property_advisors || []).map((pa) => pa.advisors).filter(Boolean),
  };
}

const PROPERTY_SELECT = "*, property_advisors(advisor_id, advisors(*))";

export const supabaseBackend = {
  mode: "supabase",

  async getProperties(filters = {}) {
    let query = supabase
      .from("properties")
      .select(PROPERTY_SELECT)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (filters.activeOnly) query = query.eq("active", true);
    if (filters.type) query = query.eq("type", filters.type);
    else if (filters.types) query = query.in("type", filters.types);
    if (filters.operation_type) query = query.eq("operation_type", filters.operation_type);
    if (filters.tipo_nave) query = query.eq("tipo_nave", filters.tipo_nave);
    if (filters.zone) query = query.eq("zone", filters.zone);
    if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
    if (filters.minArea != null) query = query.gte("area_m2", filters.minArea);
    if (filters.maxArea != null) query = query.lte("area_m2", filters.maxArea);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapPropertyRow);
  },

  async getPropertyById(id) {
    const { data, error } = await supabase.from("properties").select(PROPERTY_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapPropertyRow(data) : null;
  },

  async addProperty(data) {
    const newImages = await uploadFiles("property-images", data.imageFiles);
    const images = [...(data.existingImages || []), ...newImages];
    const newVideos = await uploadFiles("property-videos", data.videoFiles);
    const videos = [...(data.existingVideos || []), ...newVideos];
    const payload = {
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
    };
    const { data: inserted, error } = await supabase.from("properties").insert(payload).select().single();
    if (error) throw error;
    await this._syncAdvisors(inserted.id, data.advisor_ids || []);
    // Cada propiedad nueva llega ya con su proyecto de remodelación
    // vinculado — no requiere seleccionarse/capturarse a mano en
    // Remodelaciones (ver integración Propiedades → Remodelaciones →
    // Liquidación).
    await this.addRemodelProject({
      name: inserted.title,
      property_id: inserted.id,
      area_m2: inserted.area_m2,
      materials: [],
      spaces: [],
    });
    return inserted;
  },

  async updateProperty(id, data) {
    const newImages = await uploadFiles("property-images", data.imageFiles);
    const images = [...(data.existingImages || []), ...newImages];
    const newVideos = await uploadFiles("property-videos", data.videoFiles);
    const videos = [...(data.existingVideos || []), ...newVideos];
    const payload = {
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
    };
    const { data: updated, error } = await supabase.from("properties").update(payload).eq("id", id).select().single();
    if (error) throw error;
    await this._syncAdvisors(id, data.advisor_ids || []);
    return updated;
  },

  async _syncAdvisors(propertyId, advisorIds) {
    await supabase.from("property_advisors").delete().eq("property_id", propertyId);
    if (advisorIds.length > 0) {
      const rows = advisorIds.map((advisor_id) => ({ property_id: propertyId, advisor_id }));
      const { error } = await supabase.from("property_advisors").insert(rows);
      if (error) throw error;
    }
  },

  async deleteProperty(id) {
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
  },

  async getAdvisors() {
    const { data, error } = await supabase.from("advisors").select("*").order("name");
    if (error) throw error;
    return data || [];
  },

  async getAdvisorById(id) {
    const { data, error } = await supabase.from("advisors").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addAdvisor(data) {
    let photo_url = data.existingPhoto || "";
    if (data.photoFile) {
      const [url] = await uploadFiles("advisor-photos", [data.photoFile]);
      photo_url = url;
    }
    const payload = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsapp: data.whatsapp,
      bio: data.bio,
      photo_url,
      active: data.active !== false,
    };
    const { data: inserted, error } = await supabase.from("advisors").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateAdvisor(id, data) {
    let photo_url = data.existingPhoto;
    if (data.photoFile) {
      const [url] = await uploadFiles("advisor-photos", [data.photoFile]);
      photo_url = url;
    }
    const payload = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsapp: data.whatsapp,
      bio: data.bio,
      active: data.active,
      ...(photo_url ? { photo_url } : {}),
    };
    const { data: updated, error } = await supabase.from("advisors").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteAdvisor(id) {
    const { error } = await supabase.from("advisors").delete().eq("id", id);
    if (error) throw error;
  },

  async getZones() {
    const { data, error } = await supabase.from("zones").select("*").order("name");
    if (error) throw error;
    return data || [];
  },

  async addZone(data) {
    const payload = { name: data.name.trim(), price_per_m2: Number(data.price_per_m2) || 0 };
    const { data: inserted, error } = await supabase.from("zones").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async deleteZone(id) {
    const { error } = await supabase.from("zones").delete().eq("id", id);
    if (error) throw error;
  },

  async getPropertyTypes() {
    const { data, error } = await supabase.from("property_types").select("*").order("label");
    if (error) throw error;
    return data || [];
  },

  async addPropertyType(data) {
    const label = data.label.trim();
    const payload = { key: slugify(label), label };
    const { data: inserted, error } = await supabase.from("property_types").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async deletePropertyType(id) {
    const { error } = await supabase.from("property_types").delete().eq("id", id);
    if (error) throw error;
  },

  async togglePropertyTypeActive(id, active) {
    const { data, error } = await supabase.from("property_types").update({ active }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async updatePropertyTypeImage(id, file) {
    const [url] = await uploadFiles("property-images", [file]);
    const { data, error } = await supabase.from("property_types").update({ image_url: url }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async updateZonePrice(id, price_per_m2) {
    const { data, error } = await supabase
      .from("zones")
      .update({ price_per_m2: Number(price_per_m2), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async submitContactMessage(data) {
    const { error } = await supabase.from("contact_messages").insert(data);
    if (error) throw error;
    return true;
  },

  async getClients(filters = {}) {
    let query = supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (filters.type) query = query.eq("type", filters.type);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getClientById(id) {
    const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addClient(data) {
    const payload = {
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
    };
    const { data: inserted, error } = await supabase.from("clients").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateClient(id, data) {
    const payload = {
      name: data.name,
      type: data.type,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      active: data.active !== false,
      updated_at: new Date().toISOString(),
    };
    const { data: updated, error } = await supabase.from("clients").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteClient(id) {
    const { data: docs } = await supabase.from("client_documents").select("file_path").eq("client_id", id);
    if (docs?.length) {
      await supabase.storage.from("client-documents").remove(docs.map((d) => d.file_path));
    }
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
  },

  async getClientDocuments(clientId) {
    const { data, error } = await supabase
      .from("client_documents")
      .select("*")
      .eq("client_id", clientId)
      .order("captured_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const paths = data.map((d) => d.file_path);
    const { data: signed } = await supabase.storage.from("client-documents").createSignedUrls(paths, 300);
    return data.map((doc, i) => ({ ...doc, signed_url: signed?.[i]?.signedUrl || null }));
  },

  async addClientDocument({ client_id, doc_type, blob, quality_metrics }) {
    const path = `${client_id}/${doc_type}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("client-documents")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("client_documents")
      .insert({ client_id, doc_type, file_path: path, quality_metrics: quality_metrics || {} })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteClientDocument(id) {
    const { data: doc } = await supabase.from("client_documents").select("file_path").eq("id", id).maybeSingle();
    if (doc?.file_path) {
      await supabase.storage.from("client-documents").remove([doc.file_path]);
    }
    const { error } = await supabase.from("client_documents").delete().eq("id", id);
    if (error) throw error;
  },

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
    const payload = {
      name: data.name,
      category: data.category || null,
      unit: data.unit || null,
      unit_price_internal: data.unit_price_internal === "" ? null : Number(data.unit_price_internal),
      unit_price_external: data.unit_price_external === "" ? null : Number(data.unit_price_external),
      consumption_rate: data.consumption_rate === "" || data.consumption_rate == null ? null : Number(data.consumption_rate),
      consumption_basis: data.consumption_basis || null,
      active: data.active !== false,
    };
    const { data: inserted, error } = await supabase.from("materials_catalog").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateMaterialCatalogItem(id, data) {
    const payload = {
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
    const payload = {
      concepto: data.concepto.trim(),
      unidad: data.unidad?.trim() || null,
      precio_unitario: data.precio_unitario === "" ? null : Number(data.precio_unitario),
    };
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

  // La lista omite RFC/CURP/identificación: solo se piden al abrir uno.
  async getPerfilamientosVendedor(clienteId) {
    const { data, error } = await supabase
      .from("perfilamientos")
      .select(PERFILAMIENTO_VENDEDOR_LIST_FIELDS.join(", "))
      .eq("cliente_id", clienteId)
      .order("fecha_creacion", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPerfilamientoVendedorById(id) {
    const { data, error } = await supabase.from("perfilamientos").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addPerfilamientoVendedor(clienteId, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, cliente_id: clienteId, usuario_creo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("perfilamientos").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updatePerfilamientoVendedor(id, payload) {
    const row = { ...payload, fecha_modificacion: new Date().toISOString() };
    const { data, error } = await supabase.from("perfilamientos").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePerfilamientoVendedor(id) {
    const { error } = await supabase.from("perfilamientos").delete().eq("id", id);
    if (error) throw error;
  },

  // Lista omite NSS/CURP/RFC/contraseña de portal: solo se piden al abrir uno.
  async getPerfilamientosComprador(clienteId) {
    const { data, error } = await supabase
      .from("perfilamientos_comprador")
      .select(PERFILAMIENTO_COMPRADOR_LIST_FIELDS.join(", "))
      .eq("cliente_id", clienteId)
      .order("fecha_creacion", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getPerfilamientoCompradorById(id) {
    const { data, error } = await supabase.from("perfilamientos_comprador").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addPerfilamientoComprador(clienteId, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, cliente_id: clienteId, usuario_creo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("perfilamientos_comprador").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updatePerfilamientoComprador(id, payload) {
    const row = { ...payload, fecha_modificacion: new Date().toISOString() };
    const { data, error } = await supabase.from("perfilamientos_comprador").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deletePerfilamientoComprador(id) {
    const { error } = await supabase.from("perfilamientos_comprador").delete().eq("id", id);
    if (error) throw error;
  },

  // Confidencial: restringida por RLS a los dos socios (ver schema.sql). Un
  // usuario autenticado que no sea socio simplemente recibe 0 filas / error
  // de política, no un error de "tabla no existe" — es la protección real.
  async getLiquidacionByProperty(propertyId) {
    const { data, error } = await supabase.from("liquidaciones").select("*").eq("property_id", propertyId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async addLiquidacion(propertyId, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = { ...payload, property_id: propertyId, usuario_actualizo: sessionData?.session?.user?.email || null };
    const { data, error } = await supabase.from("liquidaciones").insert(row).select().single();
    if (error) throw error;
    return data;
  },

  async updateLiquidacion(id, payload) {
    const { data: sessionData } = await supabase.auth.getSession();
    const row = {
      ...payload,
      usuario_actualizo: sessionData?.session?.user?.email || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("liquidaciones").update(row).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async getRoles() {
    const { data, error } = await supabase.from("admin_roles").select("*").order("name");
    if (error) throw error;
    return data || [];
  },

  async addRole({ name, sections }) {
    const trimmed = name.trim();
    const payload = { slug: slugify(trimmed), name: trimmed, sections: sections || [] };
    const { data, error } = await supabase.from("admin_roles").insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async updateRole(id, { name, sections }) {
    const payload = { name: name.trim(), sections: sections || [] };
    const { data, error } = await supabase.from("admin_roles").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteRole(id) {
    const { error } = await supabase.from("admin_roles").delete().eq("id", id);
    if (error) throw error;
  },

  async getAccess() {
    const { data, error } = await supabase
      .from("admin_access")
      .select("*, role:admin_roles(*)")
      .order("email");
    if (error) throw error;
    return data || [];
  },

  async getMyAccess(email) {
    const { data, error } = await supabase
      .from("admin_access")
      .select("*, role:admin_roles(*)")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async addAccess({ email, role_id, advisor_id }) {
    const payload = { email: email.trim().toLowerCase(), role_id, advisor_id: advisor_id || null };
    const { data, error } = await supabase
      .from("admin_access")
      .insert(payload)
      .select("*, role:admin_roles(*)")
      .single();
    if (error) throw error;
    return data;
  },

  async updateAccess(id, { role_id, advisor_id } = {}) {
    const payload = {};
    if (role_id !== undefined) payload.role_id = role_id;
    if (advisor_id !== undefined) payload.advisor_id = advisor_id || null;
    const { data, error } = await supabase
      .from("admin_access")
      .update(payload)
      .eq("id", id)
      .select("*, role:admin_roles(*)")
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAccess(id) {
    const { error } = await supabase.from("admin_access").delete().eq("id", id);
    if (error) throw error;
  },

  async getAgendaCitas() {
    const { data, error } = await supabase
      .from("agenda_citas")
      .select("*")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  },

  async addAgendaCita({ advisor_id, client_id, titulo, fecha, hora, actividades }) {
    const payload = {
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
    };
    const { data, error } = await supabase.from("agenda_citas").insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  async getAgendaCitaById(id) {
    const { data, error } = await supabase.from("agenda_citas").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateAgendaCita(id, { advisor_id, client_id, titulo, fecha, hora, actividades }) {
    const payload = {
      advisor_id,
      client_id: client_id || null,
      titulo: titulo.trim(),
      fecha,
      hora: hora || null,
      actividades: actividades?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("agenda_citas").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteAgendaCita(id) {
    const { error } = await supabase.from("agenda_citas").delete().eq("id", id);
    if (error) throw error;
  },

  async getAgendaExpedientes(citaId) {
    const { data, error } = await supabase
      .from("agenda_expedientes")
      .select("*")
      .eq("cita_id", citaId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    if (!data?.length) return [];
    const paths = data.map((d) => d.file_path);
    const { data: signed } = await supabase.storage.from("agenda-expedientes").createSignedUrls(paths, 300);
    return data.map((entry, i) => ({ ...entry, signed_url: signed?.[i]?.signedUrl || null }));
  },

  async addAgendaExpediente({ cita_id, file }) {
    const path = `${cita_id}/${Date.now()}-${sanitizeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("agenda-expedientes")
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("agenda_expedientes")
      .insert({ cita_id, file_path: path, file_name: file.name })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAgendaExpediente(id) {
    const { data: entry } = await supabase.from("agenda_expedientes").select("file_path").eq("id", id).maybeSingle();
    if (entry?.file_path) {
      await supabase.storage.from("agenda-expedientes").remove([entry.file_path]);
    }
    const { error } = await supabase.from("agenda_expedientes").delete().eq("id", id);
    if (error) throw error;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  getCurrentSession() {
    return supabase.auth.getSession().then(({ data }) => data.session);
  },

  onAuthStateChange(callback) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },
};

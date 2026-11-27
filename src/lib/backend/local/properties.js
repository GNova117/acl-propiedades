// Backend de modo demo (localStorage): métodos de «properties» (16). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { buildHomeData } from "../../homeData";
import { ADVISORS, PROPERTIES, VENTAS_SEED, VISITS_SEED } from "../../seedData";
import { numOrNull } from "../../format";
import { compressImageFile, compressImageFiles } from "../../imageCompression";
import { getOrCreateVisitorId } from "../../visitorId";
import { applyPriceChange } from "../../propertyBadges";
import { computeSalesStats } from "../../trustStats";
import { KEYS, readStore, writeStore, writeStoreOrThrowFriendly, uid, nextPropertyCode, filesToDataUrls, withAdvisors, matchesFilters, SORTERS } from "./shared.js";
import { normalizePropertyCode } from "../../propertyUrl.js";

export const propertiesMethods = {
  // Mismo contrato opcional de paginación que supabaseBackend: sin
  // `pageSize` devuelve el arreglo completo como siempre.
  async getProperties(filters = {}) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const filtered = properties.filter((p) => matchesFilters(p, filters));
    const sorted = (SORTERS[filters.sortBy] || SORTERS.newest)(filtered).map((p) => withAdvisors(p, advisors));
    if (filters.pageSize == null) return sorted;
    const from = (filters.page || 0) * filters.pageSize;
    return { data: sorted.slice(from, from + filters.pageSize), total: sorted.length };
  },

  async getTypeCounts() {
    return buildHomeData(await this.getProperties({ activeOnly: true })).counts;
  },

  async getHomeData() {
    return buildHomeData(await this.getProperties({ activeOnly: true }));
  },

  async getPropertyRefs() {
    const all = await this.getProperties({});
    return all.map((p) => ({ id: p.id, code: p.code, title: p.title, price: p.price, advisors: (p.advisors || []).map((a) => ({ id: a.id, name: a.name })) }));
  },

  async getPropertiesByIds(ids) {
    const wanted = new Set((ids || []).filter(Boolean));
    return (await this.getProperties({ activeOnly: true })).filter((p) => wanted.has(p.id));
  },

  async getPropertyById(id) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const found = properties.find((p) => p.id === id);
    return found ? withAdvisors(found, advisors) : null;
  },

  // Mismo contrato que public_sales_stats() de Supabase, calculado sobre las
  // ventas y propiedades locales del modo demo.
  async getPublicSalesStats() {
    return computeSalesStats(readStore(KEYS.ventas, VENTAS_SEED), readStore(KEYS.properties, PROPERTIES));
  },

  // Espejo de record_property_view (schema.sql): registra como máximo una
  // vista por visitante por propiedad por día y devuelve cuántos visitantes
  // distintos la vieron en los últimos `days` días.
  async trackPropertyView(propertyId, days = 3) {
    const visitorId = getOrCreateVisitorId();
    const today = new Date().toISOString().slice(0, 10);
    const views = readStore(KEYS.propertyViews, []);
    const alreadyToday = views.some((v) => v.property_id === propertyId && v.visitor_id === visitorId && v.viewed_on === today);
    if (!alreadyToday) {
      views.push({ property_id: propertyId, visitor_id: visitorId, viewed_on: today });
      writeStore(KEYS.propertyViews, views);
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recentVisitors = new Set(
      views.filter((v) => v.property_id === propertyId && v.viewed_on > cutoffStr).map((v) => v.visitor_id)
    );
    return recentVisitors.size;
  },

  async getPropertyByCode(code) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const advisors = readStore(KEYS.advisors, ADVISORS);
    const normalized = normalizePropertyCode(code);
    const found = properties.find((p) => p.code === normalized);
    return found ? withAdvisors(found, advisors) : null;
  },

  async addProperty(data) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const newImages = await filesToDataUrls(await compressImageFiles(data.imageFiles));
    const images = [...(data.existingImages || []), ...newImages];
    const newVideos = await filesToDataUrls(data.videoFiles);
    const videos = [...(data.existingVideos || []), ...newVideos];
    const newTour360 = await filesToDataUrls(await compressImageFiles(data.tour360Files));
    const tour_360_images = [...(data.existingTour360Images || []), ...newTour360];
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
      location_approximate: data.location_approximate === true,
      status: data.status || "disponible",
      operation_type: data.operation_type || "compra",
      active: data.active !== false,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      videos,
      tour_360_images,
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
    const newTour360 = await filesToDataUrls(await compressImageFiles(data.tour360Files));
    const tour_360_images = [...(data.existingTour360Images || []), ...newTour360];
    const updated = {
      ...properties[idx],
      title: data.title,
      type: data.type,
      description: data.description,
      price: Number(data.price),
      // Espejo del trigger set_price_drop de schema.sql.
      ...applyPriceChange(properties[idx], data.price),
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
      tour_360_images,
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

  // Espejo de setPropertyFloorPlan de Supabase: el plano queda como data: URL.
  async setPropertyFloorPlan(id, file) {
    const properties = readStore(KEYS.properties, PROPERTIES);
    const idx = properties.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Propiedad no encontrada");
    const [url] = file ? await filesToDataUrls([file]) : [null];
    properties[idx] = { ...properties[idx], floor_plan_url: url, updated_at: new Date().toISOString() };
    writeStore(KEYS.properties, properties);
    return properties[idx];
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

  // Replica en JS lo que en Supabase hace _visit_report_payload (schema.sql):
  // una lista CERRADA de campos por visita — sin nombre del prospecto, sin
  // asesor, sin notas internas. Lo usan tanto la vista previa del personal como
  // la página pública por token.
  // Espejo del objeto `interest` de _visit_report_payload (schema.sql): vistas de la ficha (una por visitante y
  // día), personas distintas, personas distintas en los últimos 7 días, favoritos y veces compartida.
  _propertyInterest(propertyId) {
    const views = readStore(KEYS.propertyViews, []).filter((v) => v.property_id === propertyId);
    const events = readStore(KEYS.propertyEvents, []).filter((e) => e.property_id === propertyId);
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    return {
      views: views.length,
      unique_visitors: new Set(views.map((v) => v.visitor_id)).size,
      views_7d: new Set(views.filter((v) => v.viewed_on > weekAgo).map((v) => v.visitor_id)).size,
      favorites: new Set(events.filter((e) => e.kind === "favorite").map((e) => e.visitor_id)).size,
      shares: events.filter((e) => e.kind === "share").length,
    };
  },

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
      interest: this._propertyInterest(propertyId),
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
};

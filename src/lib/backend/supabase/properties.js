// Backend con Supabase: métodos de «properties» (13). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { FEATURED_POOL, VIDEO_POOL, buildHomeData } from "../../homeData";
import { supabase } from "../../supabaseClient";
import { numOrNull } from "../../format";
import { getOrCreateVisitorId } from "../../visitorId";
import { isValidBounds, supabaseSearchFilters } from "../../propertySearch";
import { discardUploads, collectMedia, mapPropertyRow, propertySelect, hasStaffSession, PROPERTY_SELECT_STAFF, PROPERTY_SELECT_PUBLIC, PROPERTY_SORTERS } from "./shared.js";
import { normalizePropertyCode } from "../../propertyUrl.js";

export const propertiesMethods = {
  // `page`/`pageSize` son opcionales: sin ellos se comporta exactamente
  // igual que antes (devuelve el arreglo completo) — así no se toca a los
  // ~20 llamadores (admin, reportes, el buscador global, etc.) que sí
  // necesitan el catálogo entero. Solo el listado público (/propiedades)
  // los manda, para no bajar cada propiedad —con todas sus imágenes— de
  // una sola vez conforme crece el catálogo. `count: "exact"` le pide a
  // Postgres el total de filas que cumplen el filtro en la misma consulta
  // (vía el header Content-Range), sin una segunda ida y vuelta.
  async getProperties(filters = {}) {
    const paginated = filters.pageSize != null;
    let query = supabase.from("properties").select(await propertySelect(), paginated ? { count: "exact" } : undefined);
    if (filters.activeOnly) query = query.eq("active", true);
    if (filters.type) query = query.eq("type", filters.type);
    else if (filters.types) query = query.in("type", filters.types);
    if (filters.operation_type) query = query.eq("operation_type", filters.operation_type);
    if (filters.statuses?.length) query = query.in("status", filters.statuses);
    if (filters.tipo_nave) query = query.eq("tipo_nave", filters.tipo_nave);
    if (filters.zone) {
      // Colonia exacta (páginas de aterrizaje) o parte del nombre, sin importar mayúsculas (lo que se escribe en el filtro).
      if (filters.zoneExact) query = query.eq("zone", filters.zone);
      else query = query.ilike("zone", `%${String(filters.zone).replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    }
    if (filters.minPrice != null) query = query.gte("price", filters.minPrice);
    if (filters.maxPrice != null) query = query.lte("price", filters.maxPrice);
    if (filters.minArea != null) query = query.gte("area_m2", filters.minArea);
    if (filters.maxArea != null) query = query.lte("area_m2", filters.maxArea);
    if (filters.minBedrooms != null) query = query.gte("bedrooms", filters.minBedrooms);
    if (filters.minBathrooms != null) query = query.gte("bathrooms", filters.minBathrooms);
    if (filters.minParking != null) query = query.gte("parking", filters.minParking);
    if (filters.amenities?.length) query = query.contains("amenities", filters.amenities);
    // Búsqueda de texto: un `or` por palabra (se combinan con Y). Ver propertySearch.js.
    for (const clause of supabaseSearchFilters(filters.q)) query = query.or(clause);
    // "Buscar en esta zona" del mapa.
    if (isValidBounds(filters.bounds)) {
      query = query
        .gte("lat", filters.bounds.south)
        .lte("lat", filters.bounds.north)
        .gte("lng", filters.bounds.west)
        .lte("lng", filters.bounds.east);
    }
    for (const [column, ascending] of PROPERTY_SORTERS[filters.sortBy] || PROPERTY_SORTERS.newest) {
      query = query.order(column, { ascending });
    }
    if (paginated) {
      const from = (filters.page || 0) * filters.pageSize;
      query = query.range(from, from + filters.pageSize - 1);
    }
    const { data, error, count } = await query;
    if (error) throw error;
    const mapped = (data || []).map(mapPropertyRow);
    return paginated ? { data: mapped, total: count ?? mapped.length } : mapped;
  },

  // Cuántas propiedades activas hay por tipo: { casa: 12, terreno: 3, ... }. Un conteo en el servidor (public_type_counts);
  // si esa función aún no existe (no se ha corrido el SQL), se cuenta bajando la lista como antes.
  async getTypeCounts() {
    const { data, error } = await supabase.rpc("public_type_counts");
    if (!error && data && typeof data === "object") return data;
    return buildHomeData(await this.getProperties({ activeOnly: true })).counts;
  },

  // Lo del inicio sin bajar el catálogo: conteos por tipo, cuántas están disponibles y solo los candidatos a «destacadas» y
  // «recorridos en video» (ver lib/homeData.js, que garantiza la misma selección que con todo el catálogo).
  async getHomeData() {
    const counts = await supabase.rpc("public_type_counts");
    if (counts.error || !counts.data || typeof counts.data !== "object") {
      return buildHomeData(await this.getProperties({ activeOnly: true })); // respaldo: aún sin el SQL
    }
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const select = await propertySelect();
    const base = () => supabase.from("properties").select(select).eq("active", true).eq("status", "disponible");
    const [available, newest, dropped, videos] = await Promise.all([
      supabase.from("properties").select("id", { count: "exact", head: true }).eq("active", true).eq("status", "disponible"),
      base().not("main_image", "is", null).order("created_at", { ascending: false }).limit(FEATURED_POOL),
      base().not("main_image", "is", null).not("previous_price", "is", null).gte("price_changed_at", since).order("created_at", { ascending: false }).limit(FEATURED_POOL),
      base().neq("videos", "{}").order("created_at", { ascending: false }).limit(VIDEO_POOL),
    ]);
    const failed = [available, newest, dropped, videos].find((r) => r.error);
    if (failed) throw failed.error;
    const pool = new Map([...(dropped.data || []), ...(newest.data || [])].map((row) => [row.id, mapPropertyRow(row)]));
    return {
      counts: counts.data,
      availableCount: available.count || 0,
      featuredPool: [...pool.values()],
      videoPool: (videos.data || []).map(mapPropertyRow),
    };
  },

  // Solo propiedades publicadas (activas), por sus ids: el sitio público las pide así (p. ej. las vendidas del bloque de confianza).
  async getPropertiesByIds(ids) {
    const list = (ids || []).filter(Boolean);
    if (list.length === 0) return [];
    const { data, error } = await supabase.from("properties").select(await propertySelect()).eq("active", true).in("id", list);
    if (error) throw error;
    return (data || []).map(mapPropertyRow);
  },

  async getPropertyById(id) {
    const staff = await hasStaffSession();
    const { data, error } = await supabase.from("properties").select(staff ? PROPERTY_SELECT_STAFF : PROPERTY_SELECT_PUBLIC).eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const property = mapPropertyRow(data);
    // Con la ubicación aproximada, `lat`/`lng` de la fila son el punto difuminado. El personal con Propiedades recibe las exactas
    // (la tabla las protege con RLS: para los demás la consulta vuelve vacía y se queda el punto difuminado), para que el formulario
    // las muestre y vuelva a guardar las exactas, no las difuminadas.
    if (staff && property.location_approximate) {
      const { data: exact } = await supabase.from("property_exact_location").select("lat, lng").eq("property_id", id).maybeSingle();
      if (exact) return { ...property, lat: exact.lat, lng: exact.lng };
    }
    return property;
  },

  async getPropertyByCode(code) {
    const normalized = normalizePropertyCode(code);
    const { data, error } = await supabase.from("properties").select(await propertySelect()).eq("code", normalized).maybeSingle();
    if (error) throw error;
    return data ? mapPropertyRow(data) : null;
  },

  // record_property_view (schema.sql, security definer): registra la vista
  // de este visitante (como máximo una por día, por propiedad) y devuelve en
  // la misma llamada cuántos visitantes distintos la vieron en los últimos
  // `days` días — para el indicador "N vistas recientes" de la ficha pública.
  async trackPropertyView(propertyId, days = 3) {
    const { data, error } = await supabase.rpc("record_property_view", {
      p_property_id: propertyId,
      p_visitor_id: getOrCreateVisitorId(),
      p_days: days,
    });
    if (error) throw error;
    return data || 0;
  },

  // public_sales_stats (schema.sql, security definer): cifras agregadas de
  // ventas para el inicio (total, último año, días promedio, vendidas
  // recientes). `ventas` es interna; la función no revela asesor ni fechas.
  async getPublicSalesStats() {
    const { data, error } = await supabase.rpc("public_sales_stats");
    if (error) throw error;
    return data;
  },

  async addProperty(data) {
    const uploaded = [];
    const { images, videos, tour_360_images } = await collectMedia(data, uploaded);
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
      location_approximate: data.location_approximate === true,
      status: data.status || "disponible",
      operation_type: data.operation_type || "compra",
      active: data.active !== false,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      videos,
      tour_360_images,
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
    };
    const { data: inserted, error } = await supabase.from("properties").insert(payload).select().single();
    if (error) {
      await discardUploads(uploaded);
      throw error;
    }
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
    const uploaded = [];
    const { images, videos, tour_360_images } = await collectMedia(data, uploaded);
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
      location_approximate: data.location_approximate === true,
      status: data.status,
      operation_type: data.operation_type || "compra",
      active: data.active,
      images,
      main_image: images[data.mainImageIndex ?? 0] || images[0] || "",
      videos,
      tour_360_images,
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
    const { data: updated, error } = await supabase.from("properties").update(payload).eq("id", id).select().single();
    if (error) {
      await discardUploads(uploaded);
      throw error;
    }
    await this._syncAdvisors(id, data.advisor_ids || []);
    return updated;
  },

  // Plano de la propiedad que se ve en la ficha pública (columna
  // `floor_plan_url`, ver el bloque "Plano en la ficha" de schema.sql). Va
  // aparte de addProperty/updateProperty a propósito: guardar una propiedad
  // no depende de que esa columna ya exista, solo esta acción. `file` = el
  // PNG/JPG del plano, o null para quitarlo. Se sube tal cual (sin
  // recomprimir a JPEG, que mancha las líneas finas de un plano).
  async setPropertyFloorPlan(id, file) {
    let url = null;
    let uploadedPath = null;
    if (file) {
      const ext = (file.type === "image/jpeg" ? "jpg" : "png");
      uploadedPath = `plano-${id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("property-images").upload(uploadedPath, file, { upsert: false, contentType: file.type || "image/png" });
      if (uploadError) throw uploadError;
      url = supabase.storage.from("property-images").getPublicUrl(uploadedPath).data.publicUrl;
    }
    const { data, error } = await supabase
      .from("properties")
      .update({ floor_plan_url: url, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (uploadedPath) await discardUploads([{ bucket: "property-images", path: uploadedPath }]);
      throw error;
    }
    return data;
  },

  async deleteProperty(id) {
    // Borrar la propiedad borra en cascada las filas de su bitácora, pero no
    // los comprobantes en Storage: se anotan antes y se limpian después. Es
    // "lo mejor posible" a propósito (sin el apartado 'bitacora' RLS devuelve
    // 0 filas; si la tabla aún no existe, `data` llega vacío): nada de eso
    // debe impedir borrar la propiedad.
    const { data: logFiles } = await supabase.from("property_log").select("file_path").eq("property_id", id).not("file_path", "is", null);
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
    if (logFiles?.length) await supabase.storage.from("property-log-files").remove(logFiles.map((f) => f.file_path));
  },

  async getPropertyChanges(propertyId) {
    const { data, error } = await supabase
      .from("property_changes")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

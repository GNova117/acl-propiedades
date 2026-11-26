// Backend con Supabase: métodos de «catalog» (21). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { slugify } from "../../format";
import { uploadFiles, discardUploads, hasStaffSession, PUBLIC_ADVISOR_COLUMNS, shareBriefly, forgetShared } from "./shared.js";

export const catalogMethods = {
  async _syncAdvisors(propertyId, advisorIds) {
    await supabase.from("property_advisors").delete().eq("property_id", propertyId);
    if (advisorIds.length > 0) {
      const rows = advisorIds.map((advisor_id) => ({ property_id: propertyId, advisor_id }));
      const { error } = await supabase.from("property_advisors").insert(rows);
      if (error) throw error;
    }
  },

  // Con sesión del personal: todos los asesores con todos sus datos. Sin sesión (/nosotros): solo el equipo publicado
  // (activo y con show_in_team), con el contacto que cada quien decidió mostrar ahí.
  async getAdvisors() {
    if (await hasStaffSession()) {
      const { data, error } = await supabase.from("advisors").select("*").order("name");
      if (error) throw error;
      return data || [];
    }
    const { data, error } = await supabase.rpc("team_advisors");
    if (error) throw error;
    return (data || []).map((advisor) => ({ ...advisor, active: true, show_in_team: true }));
  },

  async getAdvisorById(id) {
    const columns = (await hasStaffSession()) ? "*" : PUBLIC_ADVISOR_COLUMNS;
    const { data, error } = await supabase.from("advisors").select(columns).eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  // Asesor que mandó la selección, con el teléfono y WhatsApp que se le muestran a quien tiene el enlace (la función solo
  // responde con un token que existe, aunque la selección ya haya vencido). Nulo si el enlace no sirve o el asesor ya no
  // está activo.
  async getSelectionAdvisor(token) {
    const { data, error } = await supabase.rpc("selection_advisor", { p_token: token });
    if (error) throw error;
    return data || null;
  },

  async addAdvisor(data) {
    const uploaded = [];
    let photo_url = data.existingPhoto || "";
    if (data.photoFile) {
      const [url] = await uploadFiles("advisor-photos", [data.photoFile], uploaded);
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
      show_in_team: data.show_in_team !== false,
    };
    const { data: inserted, error } = await supabase.from("advisors").insert(payload).select().single();
    if (error) {
      await discardUploads(uploaded);
      throw error;
    }
    return inserted;
  },

  async updateAdvisor(id, data) {
    const uploaded = [];
    let photo_url = data.existingPhoto;
    if (data.photoFile) {
      // Prefijo con el id del asesor: así la política de storage para la
      // edición de perfil propio (ver schema.sql) puede comprobar que solo
      // sube a su propia carpeta, sin necesitar la sección 'asesores'.
      const [url] = await uploadFiles("advisor-photos", [data.photoFile], uploaded, `${id}/`);
      photo_url = url;
    }
    const payload = {
      name: data.name,
      phone: data.phone,
      email: data.email,
      whatsapp: data.whatsapp,
      bio: data.bio,
      // active/show_in_team solo se tocan si vienen en los datos: la edición
      // de perfil propio (AdminMyProfile, sin la sección 'asesores') no los
      // manda a propósito — son de control de la oficina. El trigger
      // advisors_guard_self_edit en Supabase los vuelve a dejar como estaban
      // de todos modos si alguien los mandara por fuera de este formulario.
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.show_in_team !== undefined ? { show_in_team: data.show_in_team !== false } : {}),
      ...(photo_url ? { photo_url } : {}),
    };
    const { data: updated, error } = await supabase.from("advisors").update(payload).eq("id", id).select().single();
    if (error) {
      await discardUploads(uploaded);
      throw error;
    }
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
    // Solo se manda si trae valor: así agregar una zona sigue funcionando en
    // una base a la que aún no se le corrió la columna `land_price_per_m2`.
    const landPrice = Number(data.land_price_per_m2) || 0;
    if (landPrice > 0) payload.land_price_per_m2 = landPrice;
    const { data: inserted, error } = await supabase.from("zones").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async deleteZone(id) {
    const { error } = await supabase.from("zones").delete().eq("id", id);
    if (error) throw error;
  },

  // `properties.zone` guarda el NOMBRE de la zona como texto libre (no es FK),
  // así que renombrar tiene que arrastrar a las propiedades que la usan o
  // quedarían con una zona que ya no existe en filtros ni selectores. Son dos
  // peticiones (no hay transacción desde el cliente): primero la zona —si el
  // nombre ya existe, falla ahí y no se tocó nada— y luego las propiedades; si
  // esas fallan, se regresa el nombre anterior.
  async renameZone(id, name) {
    const newName = name.trim();
    const { data: current, error: findError } = await supabase.from("zones").select("name").eq("id", id).single();
    if (findError) throw findError;
    if (current.name === newName) return current;
    const { data: renamed, error } = await supabase
      .from("zones")
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe una zona con ese nombre");
      throw error;
    }
    const { error: propertiesError } = await supabase.from("properties").update({ zone: newName }).eq("zone", current.name);
    if (propertiesError) {
      await supabase.from("zones").update({ name: current.name }).eq("id", id);
      throw propertiesError;
    }
    return renamed;
  },

  async getPropertyTypes() {
    const rows = await shareBriefly("property-types", async () => {
      const { data, error } = await supabase.from("property_types").select("*").order("label");
      if (error) throw error;
      return data || [];
    });
    return rows.map((row) => ({ ...row })); // cada quien recibe su copia: nadie altera la de otro
  },

  async addPropertyType(data) {
    forgetShared("property-types");
    const label = data.label.trim();
    const payload = { key: slugify(label), label };
    const { data: inserted, error } = await supabase.from("property_types").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async deletePropertyType(id) {
    forgetShared("property-types");
    const { error } = await supabase.from("property_types").delete().eq("id", id);
    if (error) throw error;
  },

  // Solo cambia el texto a mostrar: `key` (lo que guarda properties.type y usan
  // filtros/rutas) no se toca, así que no hay nada que arrastrar.
  async renamePropertyType(id, label) {
    forgetShared("property-types");
    const { data, error } = await supabase.from("property_types").update({ label: label.trim() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async getAmenities() {
    const { data, error } = await supabase.from("amenities_catalog").select("*").order("label");
    if (error) throw error;
    return data || [];
  },

  async addAmenity(data) {
    const label = data.label.trim();
    const payload = { key: slugify(label), label };
    const { data: inserted, error } = await supabase.from("amenities_catalog").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async deleteAmenity(id) {
    const { error } = await supabase.from("amenities_catalog").delete().eq("id", id);
    if (error) throw error;
  },

  // Igual que los tipos: `key` es lo que guarda cada propiedad y no cambia.
  async renameAmenity(id, label) {
    const { data, error } = await supabase.from("amenities_catalog").update({ label: label.trim() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async togglePropertyTypeActive(id, active) {
    forgetShared("property-types");
    const { data, error } = await supabase.from("property_types").update({ active }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async updatePropertyTypeImage(id, file) {
    forgetShared("property-types");
    const uploaded = [];
    const [url] = await uploadFiles("property-images", [file], uploaded);
    const { data, error } = await supabase.from("property_types").update({ image_url: url }).eq("id", id).select().single();
    if (error) {
      await discardUploads(uploaded);
      throw error;
    }
    return data;
  },

  // `land_price_per_m2` es opcional a propósito: si es undefined no entra al
  // UPDATE, así guardar solo el precio de construcción no depende de que la
  // columna de terreno ya exista en la base (ver schema.sql, "Valuación").
  async updateZonePrice(id, price_per_m2, land_price_per_m2) {
    const patch = { price_per_m2: Number(price_per_m2), updated_at: new Date().toISOString() };
    if (land_price_per_m2 !== undefined) patch.land_price_per_m2 = Number(land_price_per_m2) || 0;
    const { data, error } = await supabase
      .from("zones")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

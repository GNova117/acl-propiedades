// Backend con Supabase: métodos de «content» (30). Se juntan en supabaseBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { supabase } from "../../supabaseClient";
import { slugify } from "../../format";
import { developmentSlug, resolveDevelopmentMedia, buildDevelopmentPayload } from "../../developments";
import { fetchAll, isMissingTable, uploadFiles, discardUploads } from "./shared.js";
import { testimonialFields, siteUpdateFields } from "../../backendRules";

export const contentMethods = {
  async getTestimonials() {
    const { data, error } = await supabase.from("testimonials").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addTestimonial(data) {
    const payload = testimonialFields(data);
    const { data: inserted, error } = await supabase.from("testimonials").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateTestimonial(id, data) {
    const payload = testimonialFields(data);
    const { data: updated, error } = await supabase.from("testimonials").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async toggleTestimonialActive(id, active) {
    const { data, error } = await supabase.from("testimonials").update({ active }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteTestimonial(id) {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) throw error;
  },

  async getInternalNotes(entityType, entityId) {
    const { data, error } = await supabase
      .from("internal_notes")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addInternalNote({ entityType, entityId, body, mentions = [] }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const payload = {
      entity_type: entityType,
      entity_id: entityId,
      body: body.trim(),
      mentions,
      author_email: sessionData?.session?.user?.email || null,
    };
    const { data: inserted, error } = await supabase.from("internal_notes").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async deleteInternalNote(id) {
    const { error } = await supabase.from("internal_notes").delete().eq("id", id);
    if (error) throw error;
  },

  async getBlogPosts({ publishedOnly = false } = {}) {
    let query = supabase.from("blog_posts").select("*");
    query = publishedOnly ? query.eq("published", true).order("published_at", { ascending: false }) : query.order("created_at", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getBlogPostBySlug(slug) {
    const { data, error } = await supabase.from("blog_posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async addBlogPost(data) {
    const payload = {
      title: data.title.trim(),
      slug: slugify(data.title),
      excerpt: data.excerpt?.trim() || null,
      body: data.body.trim(),
      published: Boolean(data.published),
      published_at: data.published ? new Date().toISOString() : null,
    };
    if (data.coverFile) {
      const [url] = await uploadFiles("blog-images", [data.coverFile], []);
      payload.cover_image = url;
    }
    let { data: inserted, error } = await supabase.from("blog_posts").insert(payload).select().single();
    if (error?.code === "23505") {
      payload.slug = `${payload.slug}-${Math.random().toString(36).slice(2, 6)}`;
      ({ data: inserted, error } = await supabase.from("blog_posts").insert(payload).select().single());
    }
    if (error) throw error;
    return inserted;
  },

  async updateBlogPost(id, data, existing) {
    const payload = {
      title: data.title.trim(),
      excerpt: data.excerpt?.trim() || null,
      body: data.body.trim(),
      published: Boolean(data.published),
      updated_at: new Date().toISOString(),
    };
    if (data.published && !existing?.published_at) payload.published_at = new Date().toISOString();
    if (data.coverFile) {
      const [url] = await uploadFiles("blog-images", [data.coverFile], []);
      payload.cover_image = url;
    } else if (data.removeCover) {
      payload.cover_image = null;
    }
    const { data: updated, error } = await supabase.from("blog_posts").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteBlogPost(id) {
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw error;
  },

  // Desarrollos (torres): ver developments.js. Modelos y departamentos van en
  // columnas jsonb de la fila; las fotos al bucket público property-images.
  async getDevelopments({ publishedOnly = false } = {}) {
    let query = supabase.from("developments").select("*").order("created_at", { ascending: false });
    if (publishedOnly) query = query.eq("published", true);
    const { data, error } = await query;
    // Antes de correr el bloque "Desarrollos" de schema.sql la tabla no existe:
    // el sitio público sigue funcionando, solo sin la sección.
    if (isMissingTable(error)) return [];
    if (error) throw error;
    return data || [];
  },

  async getDevelopmentBySlug(slug) {
    const { data, error } = await supabase.from("developments").select("*").eq("slug", slug).eq("published", true).maybeSingle();
    if (isMissingTable(error)) return null;
    if (error) throw error;
    return data || null;
  },

  async getDevelopmentById(id) {
    const { data, error } = await supabase.from("developments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data || null;
  },

  async saveDevelopment(data, existing) {
    const uploaded = [];
    let payload;
    try {
      const media = await resolveDevelopmentMedia(data, (files) => uploadFiles("property-images", files, uploaded, "desarrollos/"));
      payload = buildDevelopmentPayload(data, media);
    } catch (err) {
      await discardUploads(uploaded);
      throw err;
    }
    payload.updated_at = new Date().toISOString();
    let result;
    if (existing) {
      result = await supabase.from("developments").update(payload).eq("id", existing.id).select().single();
    } else {
      payload.slug = developmentSlug(payload.name);
      result = await supabase.from("developments").insert(payload).select().single();
      if (result.error?.code === "23505") {
        payload.slug = `${payload.slug}-${Math.random().toString(36).slice(2, 6)}`;
        result = await supabase.from("developments").insert(payload).select().single();
      }
    }
    if (result.error) {
      await discardUploads(uploaded);
      throw result.error;
    }
    return result.data;
  },

  async deleteDevelopment(id) {
    const { error } = await supabase.from("developments").delete().eq("id", id);
    if (error) throw error;
  },

  async setDevelopmentUnitStatus(id, unitNumber, status) {
    const current = await this.getDevelopmentById(id);
    if (!current) throw new Error("Desarrollo no encontrado");
    const units = current.units.map((u) => (u.number === unitNumber ? { ...u, status } : u));
    const { data, error } = await supabase.from("developments").update({ units, updated_at: new Date().toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async getSiteUpdates() {
    const { data, error } = await supabase.from("site_updates").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async addSiteUpdate(data) {
    const { data: sessionData } = await supabase.auth.getSession();
    const payload = {
      ...siteUpdateFields(data),
      created_by: sessionData?.session?.user?.email || null,
    };
    const { data: inserted, error } = await supabase.from("site_updates").insert(payload).select().single();
    if (error) throw error;
    return inserted;
  },

  async updateSiteUpdate(id, data) {
    const payload = { ...siteUpdateFields(data), updated_at: new Date().toISOString() };
    const { data: updated, error } = await supabase.from("site_updates").update(payload).eq("id", id).select().single();
    if (error) throw error;
    return updated;
  },

  async deleteSiteUpdate(id) {
    const { error } = await supabase.from("site_updates").delete().eq("id", id);
    if (error) throw error;
  },

  // Envío puntual de un correo (botón "Enviar por correo" en Visitas/Gastos),
  // vía la Edge Function enviar-correo (Resend). `attachment` es opcional:
  // { filename, contentBase64 }.
  async sendEmail({ to, subject, html, attachment }) {
    const { data, error } = await supabase.functions.invoke("enviar-correo", { body: { to, subject, html, attachment } });
    if (error) throw error;
    return data;
  },

  async submitContactMessage(data) {
    const { error } = await supabase.from("contact_messages").insert(data);
    if (error) {
      // 54429: el servidor frenó el exceso de envíos desde esta conexión (ver «Freno de envíos públicos» en schema.sql).
      if (error.code === "54429") throw Object.assign(new Error(error.message), { code: "rate_limited" });
      throw error;
    }
    return true;
  },

  // Solo el número (sin bajar los mensajes): lo usa el contador del menú.
  async countNewContactMessages() {
    const { count, error } = await supabase.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "nuevo");
    if (error) throw error;
    return count || 0;
  },

  // Tiempo real (Supabase Realtime): avisa de cada cambio en mensajes y prospectos mientras haya sesión. Devuelve cómo cerrarlo.
  subscribeToChanges(onEvent) {
    const channel = supabase.channel("admin-live");
    for (const table of ["contact_messages", "prospectos", "client_intake_links"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => onEvent({ table, type: payload.eventType, record: payload.new || null }));
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getContactMessages() {
    return fetchAll(() => supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).order("id"));
  },

  async updateContactMessageStatus(id, status) {
    const { data, error } = await supabase.from("contact_messages").update({ status }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  },

  async deleteContactMessage(id) {
    const { error } = await supabase.from("contact_messages").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};

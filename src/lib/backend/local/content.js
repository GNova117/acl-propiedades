// Backend de modo demo (localStorage): métodos de «content» (30). Se juntan en localBackend.js; `this` es el objeto completo, así que
// un método puede llamar a los de otros módulos como siempre.
import { DEMO_ADMIN } from "../../seedData";
import { slugify } from "../../format";
import { compressImageFiles } from "../../imageCompression";
import { DEVELOPMENTS_SEED } from "../../developmentsSeed";
import { developmentSlug, resolveDevelopmentMedia, buildDevelopmentPayload } from "../../developments";
import { KEYS, BLOG_POSTS_SEED, readStore, writeStore, FILE_QUOTA_MESSAGE, writeStoreOrThrowFriendly, uid, fileToDataUrl, filesToDataUrls, getSession } from "./shared.js";

export const contentMethods = {
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

  async getInternalNotes(entityType, entityId) {
    const notes = readStore(KEYS.internalNotes, []);
    return notes
      .filter((n) => n.entity_type === entityType && n.entity_id === entityId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async addInternalNote({ entityType, entityId, body, mentions = [] }) {
    const notes = readStore(KEYS.internalNotes, []);
    const record = {
      id: uid("note"),
      entity_type: entityType,
      entity_id: entityId,
      body: body.trim(),
      mentions,
      author_email: getSession()?.user?.email || DEMO_ADMIN.email,
      created_at: new Date().toISOString(),
    };
    notes.push(record);
    writeStore(KEYS.internalNotes, notes);
    return record;
  },

  async deleteInternalNote(id) {
    const notes = readStore(KEYS.internalNotes, []);
    writeStore(KEYS.internalNotes, notes.filter((n) => n.id !== id));
  },

  async getBlogPosts({ publishedOnly = false } = {}) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    const filtered = publishedOnly ? posts.filter((p) => p.published) : posts;
    return filtered.slice().sort((a, b) => {
      const da = publishedOnly ? a.published_at : a.created_at;
      const db_ = publishedOnly ? b.published_at : b.created_at;
      return new Date(db_) - new Date(da);
    });
  },

  async getBlogPostBySlug(slug) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    return posts.find((p) => p.slug === slug && p.published) || null;
  },

  async addBlogPost(data) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    let slug = slugify(data.title);
    if (posts.some((p) => p.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();
    const record = {
      id: uid("blog"),
      title: data.title.trim(),
      slug,
      excerpt: data.excerpt?.trim() || null,
      body: data.body.trim(),
      cover_image: data.coverFile ? await fileToDataUrl(data.coverFile) : null,
      published: Boolean(data.published),
      published_at: data.published ? now : null,
      created_at: now,
      updated_at: now,
    };
    posts.push(record);
    writeStore(KEYS.blogPosts, posts);
    return record;
  },

  async updateBlogPost(id, data, existing) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    const idx = posts.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error("Artículo no encontrado");
    const current = posts[idx];
    posts[idx] = {
      ...current,
      title: data.title.trim(),
      excerpt: data.excerpt?.trim() || null,
      body: data.body.trim(),
      published: Boolean(data.published),
      published_at: data.published ? current.published_at || (existing?.published_at ?? new Date().toISOString()) : current.published_at,
      cover_image: data.coverFile ? await fileToDataUrl(data.coverFile) : data.removeCover ? null : current.cover_image,
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.blogPosts, posts);
    return posts[idx];
  },

  async deleteBlogPost(id) {
    const posts = readStore(KEYS.blogPosts, BLOG_POSTS_SEED);
    writeStore(KEYS.blogPosts, posts.filter((p) => p.id !== id));
  },

  // Desarrollos (torres): ver developments.js. En modo demo viven completos
  // (modelos y departamentos incluidos) en un solo registro de localStorage.
  async getDevelopments({ publishedOnly = false } = {}) {
    const developments = readStore(KEYS.developments, DEVELOPMENTS_SEED);
    const filtered = publishedOnly ? developments.filter((d) => d.published) : developments;
    return filtered.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async getDevelopmentBySlug(slug) {
    const developments = readStore(KEYS.developments, DEVELOPMENTS_SEED);
    return developments.find((d) => d.slug === slug && d.published) || null;
  },

  async getDevelopmentById(id) {
    const developments = readStore(KEYS.developments, DEVELOPMENTS_SEED);
    return developments.find((d) => d.id === id) || null;
  },

  async saveDevelopment(data, existing) {
    const developments = readStore(KEYS.developments, DEVELOPMENTS_SEED);
    const media = await resolveDevelopmentMedia(data, async (files) => filesToDataUrls(await compressImageFiles(files)));
    const payload = buildDevelopmentPayload(data, media);
    const now = new Date().toISOString();
    if (existing) {
      const idx = developments.findIndex((d) => d.id === existing.id);
      if (idx === -1) throw new Error("Desarrollo no encontrado");
      developments[idx] = { ...developments[idx], ...payload, updated_at: now };
      writeStoreOrThrowFriendly(KEYS.developments, developments, FILE_QUOTA_MESSAGE);
      return developments[idx];
    }
    let slug = developmentSlug(payload.name);
    if (developments.some((d) => d.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const record = { id: uid("dev"), slug, ...payload, created_at: now, updated_at: now };
    developments.push(record);
    writeStoreOrThrowFriendly(KEYS.developments, developments, FILE_QUOTA_MESSAGE);
    return record;
  },

  async deleteDevelopment(id) {
    const developments = readStore(KEYS.developments, DEVELOPMENTS_SEED);
    writeStore(KEYS.developments, developments.filter((d) => d.id !== id));
  },

  async setDevelopmentUnitStatus(id, unitNumber, status) {
    const developments = readStore(KEYS.developments, DEVELOPMENTS_SEED);
    const idx = developments.findIndex((d) => d.id === id);
    if (idx === -1) throw new Error("Desarrollo no encontrado");
    developments[idx] = {
      ...developments[idx],
      units: developments[idx].units.map((u) => (u.number === unitNumber ? { ...u, status } : u)),
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.developments, developments);
    return developments[idx];
  },

  async getSiteUpdates() {
    const updates = readStore(KEYS.siteUpdates, []);
    return updates.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  async addSiteUpdate(data) {
    const updates = readStore(KEYS.siteUpdates, []);
    const now = new Date().toISOString();
    const record = {
      id: uid("update"),
      title: data.title.trim(),
      body: data.body.trim(),
      created_by: DEMO_ADMIN.email,
      created_at: now,
      updated_at: now,
    };
    updates.push(record);
    writeStore(KEYS.siteUpdates, updates);
    return record;
  },

  async updateSiteUpdate(id, data) {
    const updates = readStore(KEYS.siteUpdates, []);
    const idx = updates.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("Entrada no encontrada");
    updates[idx] = {
      ...updates[idx],
      title: data.title.trim(),
      body: data.body.trim(),
      updated_at: new Date().toISOString(),
    };
    writeStore(KEYS.siteUpdates, updates);
    return updates[idx];
  },

  async deleteSiteUpdate(id) {
    const updates = readStore(KEYS.siteUpdates, []);
    writeStore(KEYS.siteUpdates, updates.filter((u) => u.id !== id));
  },

  // Modo demo no tiene backend de correo real (eso solo existe con Supabase
  // + la Edge Function enviar-correo) — simula el envío para que el botón se
  // pueda probar sin tronar.
  async sendEmail({ to }) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ok: true, demo: true, to };
  },

  async submitContactMessage(data) {
    const messages = readStore(KEYS.messages, []);
    messages.push({ id: uid("msg"), ...data, status: "nuevo", created_at: new Date().toISOString() });
    writeStore(KEYS.messages, messages);
    return true;
  },

  async countNewContactMessages() {
    return readStore(KEYS.messages, []).filter((m) => (m.status || "nuevo") === "nuevo").length;
  },

  // Tiempo real (demo): no hay servidor, pero lo que otra pestaña del mismo navegador guarda (evento «storage») o esta misma
  // pestaña (evento propio de writeStore) se reparte igual, para poder ver el comportamiento sin Supabase.
  subscribeToChanges(onEvent) {
    const tableOf = { [KEYS.messages]: "contact_messages", [KEYS.prospects]: "prospectos" };
    const fromStorage = (e) => tableOf[e.key] && onEvent({ table: tableOf[e.key], type: "CHANGE", record: null });
    const fromSelf = (e) => tableOf[e.detail?.key] && onEvent({ table: tableOf[e.detail.key], type: "CHANGE", record: null });
    window.addEventListener("storage", fromStorage);
    window.addEventListener("acl-local-change", fromSelf);
    return () => {
      window.removeEventListener("storage", fromStorage);
      window.removeEventListener("acl-local-change", fromSelf);
    };
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
};

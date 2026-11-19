// Piezas compartidas por los módulos de Backend de modo demo (localStorage) (ver localBackend.js): constantes y ayudantes de este lado.
import { CLIENT_EXPEDIENTE_KEYS } from "../../clientExpedienteFields";
import { matchesBounds, matchesSearch } from "../../propertySearch";

export function clientExpedientePayload(data) {
  return Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, data[key] || null]));
}

// Marca (solo de esta pestaña/sesión del navegador) de que ya se confirmó el código de dos pasos en modo demo.
export const MFA_OK_KEY = "acl_local_mfa_ok";

export const KEYS = {
  properties: "acl_local_properties",
  selections: "acl_local_selecciones",
  advisors: "acl_local_advisors",
  zones: "acl_local_zones",
  propertyTypes: "acl_local_property_types",
  session: "acl_local_session",
  clients: "acl_local_clients",
  clientDocuments: "acl_local_client_documents",
  clientLinks: "acl_local_client_links",
  remodelProjects: "acl_local_remodel_projects",
  remodelProgress: "acl_local_remodel_progress",
  materialsCatalog: "acl_local_materials_catalog",
  laborCatalog: "acl_local_labor_catalog",
  perfilamientosVendedor: "acl_local_perfilamientos",
  perfilamientosComprador: "acl_local_perfilamientos_comprador",
  liquidaciones: "acl_local_liquidaciones",
  ventas: "acl_local_ventas",
  propertyLog: "acl_local_property_log",
  propertyBudgets: "acl_local_property_budgets",
  visits: "acl_local_visits",
  inspections: "acl_local_inspections",
  expenseConcepts: "acl_local_expense_concepts",
  expenseReports: "acl_local_expense_reports",
  keyLog: "acl_local_key_log",
  docLog: "acl_local_doc_log",
  valuations: "acl_local_valuation_estimates",
  solicitudesAvaluo: "acl_local_solicitudes_avaluo",
  solicitudesCredito: "acl_local_solicitudes_credito",
  marketSnapshots: "acl_local_market_snapshots",
  prospects: "acl_local_prospectos",
  signing: "acl_local_signing_requests",
  prospectStages: "acl_local_prospect_stages",
  prospectContacts: "acl_local_prospect_contacts",
  advisorGoals: "acl_local_advisor_goals",
  alerts: "acl_local_property_alerts",
  reportLinks: "acl_local_report_links",
  adminRoles: "acl_local_admin_roles",
  adminAccess: "acl_local_admin_access",
  agendaCitas: "acl_local_agenda_citas",
  agendaExpedientes: "acl_local_agenda_expedientes",
  amenities: "acl_local_amenities",
  propertyCodeSeq: "acl_local_property_code_seq",
  mfa: "acl_local_mfa",
  clientErrors: "acl_local_client_errors",
  devices: "acl_local_devices",
  messages: "acl_local_messages",
  testimonials: "acl_local_testimonials",
  propertyChanges: "acl_local_property_changes",
  siteUpdates: "acl_local_site_updates",
  blogPosts: "acl_local_blog_posts",
  clientPortalTokens: "acl_local_client_portal_tokens",
  clientTramites: "acl_local_client_tramites",
  documentAccessLog: "acl_local_document_access_log",
  privacyConsents: "acl_local_privacy_consents",
  documentTemplates: "acl_local_document_templates",
  internalNotes: "acl_local_internal_notes",
  propertyViews: "acl_local_property_views",
  propertyEvents: "acl_local_property_events",
  visitFeedback: "acl_local_visit_feedback",
  propertyOffers: "acl_local_property_offers",
  propertyHolds: "acl_local_property_holds",
  propertyContracts: "acl_local_property_contracts",
  commissions: "acl_local_commissions",
  developments: "acl_local_developments",
  visitSchedules: "acl_local_visit_schedules",
  visitAttempts: "acl_local_visit_attempts",
};

// Un par de artículos de muestra para que /blog no se vea vacío en modo
// demo — en Supabase blog_posts arranca sin filas, el staff lo llena desde
// /admin/blog.
export const BLOG_POSTS_SEED = [
  {
    id: "blog-demo-1",
    title: "Guía para comprar casa por primera vez en La Comarca Lagunera",
    slug: "guia-comprar-casa-primera-vez-comarca-lagunera",
    excerpt: "Los pasos, documentos y errores comunes a la hora de comprar tu primera casa en Torreón, Gómez Palacio o Lerdo.",
    body: "Comprar tu primera casa puede parecer complicado, pero con la guía correcta el proceso es mucho más sencillo...\n\n1. Define tu presupuesto real, incluyendo gastos notariales y de escrituración.\n2. Revisa tu historial crediticio si piensas usar un crédito INFONAVIT o bancario.\n3. Visita varias propiedades antes de decidir.\n4. Pide siempre el estado legal del inmueble (libre de gravamen).\n\nEn ACL Propiedades te acompañamos en cada paso.",
    cover_image: null,
    published: true,
    published_at: "2026-09-15T12:00:00.000Z",
    created_at: "2026-09-15T12:00:00.000Z",
    updated_at: "2026-09-15T12:00:00.000Z",
  },
  {
    id: "blog-demo-2",
    title: "¿Vale la pena invertir en una nave industrial en Torreón?",
    slug: "vale-la-pena-invertir-nave-industrial-torreon",
    excerpt: "La Comarca Lagunera se ha vuelto un polo logístico importante. Qué revisar antes de invertir en una nave industrial.",
    body: "La ubicación estratégica de Torreón y Gómez Palacio, junto con el crecimiento del sector logístico, ha hecho que las naves industriales sean una de las inversiones más buscadas en la región...\n\nAlgunos puntos clave: acceso a carreteras principales, altura libre, capacidad eléctrica y zonificación industrial vigente.",
    cover_image: null,
    published: true,
    published_at: "2026-09-22T12:00:00.000Z",
    created_at: "2026-09-22T12:00:00.000Z",
    updated_at: "2026-09-22T12:00:00.000Z",
  },
];

export function readStore(key, fallback) {
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

export function writeStore(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  // Aviso para subscribeToChanges (tiempo real del modo demo): «storage» solo llega a las OTRAS pestañas.
  if (typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") window.dispatchEvent(new CustomEvent("acl-local-change", { detail: { key } }));
}

// Los videos de propiedad, guardados como data: URL en localStorage (igual
// que las fotos), pueden fácilmente superar el límite de almacenamiento del
// navegador (unos 5-10 MB por origen, muy por debajo de lo que pesa un
// video real) — a diferencia de Supabase Storage, que sí puede con eso. Si
// el guardado falla por cuota, se avisa con un mensaje claro en vez de
// dejar pasar el DOMException genérico del navegador.
export const VIDEO_QUOTA_MESSAGE =
  "No se pudo guardar: el video es demasiado grande para el almacenamiento del navegador en modo demo. Prueba con un archivo más corto/ligero, o usa esta función con Supabase conectado (ahí no aplica este límite).";
export const FILE_QUOTA_MESSAGE =
  "No se pudo guardar: el archivo es demasiado grande para el almacenamiento del navegador en modo demo. Prueba con uno más ligero, o usa esta función con Supabase conectado (ahí no aplica este límite).";

export function writeStoreOrThrowFriendly(key, value, quotaMessage = VIDEO_QUOTA_MESSAGE) {
  try {
    writeStore(key, value);
  } catch (err) {
    if (err.name === "QuotaExceededError") throw new Error(quotaMessage);
    throw err;
  }
}

export function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Como la base real al repetir un id (código 23505): la cola sin señal lo da por ya enviado.
export const duplicateKeyError = () => Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });

// Arranca después de los 9 códigos sembrados (ACL-1001..1009) — mismo
// esquema que la secuencia de Postgres (properties_code_seq start 1001),
// solo que aquí no hay trigger de base de datos que lo haga solo.
export function nextPropertyCode() {
  const current = Number(window.localStorage.getItem(KEYS.propertyCodeSeq) || "1009");
  const next = current + 1;
  window.localStorage.setItem(KEYS.propertyCodeSeq, String(next));
  return `ACL-${next}`;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function filesToDataUrls(files) {
  if (!files || files.length === 0) return [];
  return Promise.all(Array.from(files).map(fileToDataUrl));
}

export function withAdvisors(property, advisors) {
  const assigned = advisors.filter((a) => (property.advisor_ids || []).includes(a.id));
  return { ...property, advisors: assigned };
}

export function matchesFilters(property, filters = {}) {
  if (filters.activeOnly && !property.active) return false;
  if (filters.type && property.type !== filters.type) return false;
  else if (!filters.type && filters.types && !filters.types.includes(property.type)) return false;
  if (filters.operation_type && property.operation_type !== filters.operation_type) return false;
  if (filters.tipo_nave && property.tipo_nave !== filters.tipo_nave) return false;
  if (filters.zone && property.zone !== filters.zone) return false;
  if (filters.minPrice != null && property.price < filters.minPrice) return false;
  if (filters.maxPrice != null && property.price > filters.maxPrice) return false;
  if (filters.minArea != null && property.area_m2 < filters.minArea) return false;
  if (filters.maxArea != null && property.area_m2 > filters.maxArea) return false;
  if (filters.minBedrooms != null && (property.bedrooms ?? -Infinity) < filters.minBedrooms) return false;
  if (filters.minBathrooms != null && (property.bathrooms ?? -Infinity) < filters.minBathrooms) return false;
  if (filters.minParking != null && (property.parking ?? -Infinity) < filters.minParking) return false;
  if (filters.amenities?.length && !filters.amenities.every((a) => (property.amenities || []).includes(a))) return false;
  if (filters.q && !matchesSearch(property, filters.q)) return false;
  if (filters.bounds && !matchesBounds(property, filters.bounds)) return false;
  return true;
}

// "newest" en modo local es orden de inserción invertido — a diferencia
// de Supabase, los registros sembrados/agregados aquí no tienen un
// created_at real que ordenar.
export const SORTERS = {
  newest: (list) => list.slice().reverse(),
  price_asc: (list) => list.slice().sort((a, b) => a.price - b.price),
  price_desc: (list) => list.slice().sort((a, b) => b.price - a.price),
  area_desc: (list) => list.slice().sort((a, b) => b.area_m2 - a.area_m2),
};

export const authListeners = new Set();

export function getSession() {
  try {
    return JSON.parse(window.localStorage.getItem(KEYS.session) || "null");
  } catch {
    return null;
  }
}

export function notifyAuthListeners() {
  const session = getSession();
  authListeners.forEach((cb) => cb(session));
}

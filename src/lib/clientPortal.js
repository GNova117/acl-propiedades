// Funciones puras del portal de documentos para clientes (/documentos/<token>):
// sin React ni backend, las usan el panel del asesor (generar/copiar el
// enlace), la página pública y los dos backends (supabaseBackend/localBackend).
// Mismo formato de token que property_report_links (32 hex, 128 bits) — ver
// generateReportToken() en visitReport.js, de donde se copió el patrón.

export const PORTAL_TOKEN_PATTERN = /^[0-9a-f]{32}$/;
export const PORTAL_TOKEN_TTL_DAYS = 14;

// Versión del aviso de privacidad que el cliente aceptó — súbela si el
// texto del aviso cambia de forma importante, así la bitácora de
// consentimiento (privacy_consents) distingue quién aceptó cuál versión.
export const PORTAL_CONSENT_VERSION = "2026-10-v1";

export function generatePortalToken() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function portalLinkPath(token) {
  return `/documentos/${token}`;
}

export const PORTAL_DOC_TYPES = ["cedula_fiscal", "acta_nacimiento"];

// Campos que la extracción automática intenta leer de cada tipo de
// documento — mismo orden en el formulario de confirmación del cliente y en
// la tarjeta de revisión del admin (AdminClientDocuments.jsx).
export const PORTAL_FIELD_DEFS = {
  cedula_fiscal: [
    { key: "rfc", labelKey: "portal.fields.rfc" },
    { key: "nombre", labelKey: "portal.fields.nombre" },
    { key: "regimen", labelKey: "portal.fields.regimen" },
    { key: "domicilioFiscal", labelKey: "portal.fields.domicilioFiscal" },
    { key: "fechaEmision", labelKey: "portal.fields.fechaEmision", type: "date" },
  ],
  acta_nacimiento: [
    { key: "curp", labelKey: "portal.fields.curp" },
    { key: "nombre", labelKey: "portal.fields.nombre" },
    { key: "fechaNacimiento", labelKey: "portal.fields.fechaNacimiento", type: "date" },
    { key: "folio", labelKey: "portal.fields.folio" },
  ],
};

// Estados posibles de un documento del portal (review_status en la base).
export const PORTAL_REVIEW_STATUSES = ["pendiente", "valido", "requiere_revision", "rechazado"];

// Error con el código que regresa api/portal-upload.js (invalid_token,
// file_too_large, invalid_file_type, suspicious_pdf, rate_limited...) — la
// UI lo traduce con portal.errors.<code> (ver i18n), con un mensaje
// genérico si llega un código que no se tradujo.
export class PortalUploadError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Se enlaza al dominio oficial raíz (no a una ruta profunda): el SAT y
// gob.mx reorganizan sus URLs de trámite de vez en cuando, y un enlace roto
// es peor que uno genérico con instrucciones claras de qué buscar. Revisar
// antes de publicar si conviene apuntar a la ruta exacta del trámite.
export const PORTAL_OFFICIAL_URLS = {
  cedula_fiscal: "https://www.sat.gob.mx/",
  acta_nacimiento: "https://www.gob.mx/actas",
};

// El documento más reciente de un tipo (p. ej. si el cliente "reemplaza" su
// constancia, hay varias filas y la pantalla solo debe mostrar la última).
export function latestPortalDoc(documents, docType, fileKind = "document") {
  return (documents || [])
    .filter((d) => d.doc_type === docType && (d.file_kind || "document") === fileKind)
    .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0] || null;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ── Más documentos, lista de pendientes y estatus del trámite (2026-11) ──

// Lo que el cliente puede subir desde el portal. Solo la constancia y el
// acta tienen lectura automática (texto + QR, ver api/portal-upload.js); el
// resto queda "En revisión" hasta que el asesor lo apruebe. Todos son tipos
// que ya existían en client_documents (no cambia el check de doc_type).
export const PORTAL_UPLOADABLE_DOC_TYPES = [
  "ine",
  "curp",
  "acta_nacimiento",
  "cedula_fiscal",
  "escrituras",
  "predial",
  "agua",
  "luz",
  "cuenta_bancaria",
];

export const PORTAL_EXTRACTED_DOC_TYPES = ["cedula_fiscal", "acta_nacimiento"];

export const isExtractedDocType = (docType) => PORTAL_EXTRACTED_DOC_TYPES.includes(docType);

// Los que se leen automáticamente tienen que ser el PDF oficial; el resto
// (INE, recibos, escrituras escaneadas) también se acepta como foto.
export const portalAcceptsImage = (docType) => !isExtractedDocType(docType);

// Enlaces oficiales para los documentos que se descargan de un portal de
// gobierno. Los demás (INE, recibos, escrituras) los tiene el cliente en
// papel: no hay enlace, solo instrucciones de cómo fotografiarlos.
export const PORTAL_OFFICIAL_LINKS = {
  ...PORTAL_OFFICIAL_URLS,
  curp: "https://www.gob.mx/curp/",
};

// Qué se le pide por omisión según el tipo de cliente, hasta que el asesor
// marque otra cosa en la ficha. Sigue el orden de PORTAL_UPLOADABLE_DOC_TYPES.
const DEFAULT_DOCS_BY_CLIENT_TYPE = {
  comprador: ["ine", "curp", "acta_nacimiento", "cedula_fiscal"],
  vendedor: ["ine", "curp", "acta_nacimiento", "cedula_fiscal", "escrituras", "predial", "agua", "luz"],
};

export function defaultRequestedDocs(clientType) {
  if (clientType === "ambos") {
    const union = new Set([...DEFAULT_DOCS_BY_CLIENT_TYPE.comprador, ...DEFAULT_DOCS_BY_CLIENT_TYPE.vendedor]);
    return PORTAL_UPLOADABLE_DOC_TYPES.filter((d) => union.has(d));
  }
  return DEFAULT_DOCS_BY_CLIENT_TYPE[clientType] || DEFAULT_DOCS_BY_CLIENT_TYPE.comprador;
}

// Lista final de documentos pedidos: la que guardó el asesor (limpia de
// tipos que el portal no admite y en el orden de siempre) o la de omisión.
export function requestedDocsFor(tramite, clientType) {
  const saved = Array.isArray(tramite?.requested_docs) ? tramite.requested_docs : null;
  if (!saved || saved.length === 0) return defaultRequestedDocs(clientType);
  return PORTAL_UPLOADABLE_DOC_TYPES.filter((d) => saved.includes(d));
}

// Estado de un documento en la lista de pendientes del cliente:
//  · "pendiente"  — no ha subido nada;
//  · "en_revision" — ya lo subió y el asesor no lo ha revisado;
//  · "corregir"   — el asesor lo rechazó (con motivo): hay que volver a subirlo;
//  · "aprobado"   — el asesor lo aprobó;
//  · "recibido"   — lo entregó en la oficina (lo capturó el asesor).
export const CHECKLIST_STATES = ["pendiente", "corregir", "en_revision", "aprobado", "recibido"];
const DONE_STATES = new Set(["aprobado", "recibido"]);

function checklistState(doc) {
  if (!doc) return "pendiente";
  if (doc.source && doc.source !== "client_portal") return "recibido";
  if (doc.review_status === "valido") return "aprobado";
  if (doc.review_status === "rechazado") return "corregir";
  return "en_revision";
}

// `documents`: los del portal (con review_status); `officeDocuments`: los
// que capturó el asesor (solo doc_type y captured_at). Manda el más
// reciente de los dos: si el cliente volvió a subir uno después de
// entregarlo en oficina, lo que importa es la revisión del nuevo.
export function portalChecklist(requestedDocs, documents = [], officeDocuments = []) {
  return requestedDocs.map((docType) => {
    const portalDoc = latestPortalDoc(documents, docType);
    const officeDoc =
      (officeDocuments || [])
        .filter((d) => d.doc_type === docType)
        .map((d) => ({ ...d, source: d.source || "admin_capture" }))
        .sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0] || null;
    let doc = portalDoc || officeDoc;
    if (portalDoc && officeDoc && new Date(officeDoc.captured_at) > new Date(portalDoc.captured_at)) doc = officeDoc;
    return { docType, state: checklistState(doc), doc };
  });
}

// Resumen para la barra de avance: cuántos ya están listos (aprobados o
// entregados), cuántos esperan revisión y cuántos le toca hacer al cliente.
export function checklistSummary(items) {
  const count = (pred) => items.filter(pred).length;
  return {
    total: items.length,
    done: count((i) => DONE_STATES.has(i.state)),
    inReview: count((i) => i.state === "en_revision"),
    todo: count((i) => i.state === "pendiente" || i.state === "corregir"),
  };
}

// Lo que todavía le toca hacer al cliente, primero lo que hay que corregir.
export function clientTodo(items) {
  return [...items.filter((i) => i.state === "corregir"), ...items.filter((i) => i.state === "pendiente")];
}

// Etapas del trámite que ve el cliente. Dependen de qué está haciendo: si
// compra con crédito pasa por avalúo y autorización; de contado, no; si
// vende, por promoción y oferta. Las claves se guardan en
// client_tramites.stage — si se agrega una, también va en el check de
// schema.sql (bloque "Portal del cliente: pendientes y estatus del trámite").
export const TRAMITE_STAGE_KEYS = ["documentos", "revision", "promocion", "oferta", "avaluo", "credito", "firma", "entrega"];

const TRAMITE_FLOWS = {
  compra_credito: ["documentos", "revision", "avaluo", "credito", "firma", "entrega"],
  compra_contado: ["documentos", "revision", "firma", "entrega"],
  venta: ["documentos", "revision", "promocion", "oferta", "firma", "entrega"],
};

export function tramiteFlowFor({ type, financiamiento } = {}) {
  if (type === "vendedor") return "venta";
  if (type === "ambos" && !financiamiento) return "venta";
  return financiamiento === "contado" ? "compra_contado" : "compra_credito";
}

export function tramiteStagesFor(client) {
  return TRAMITE_FLOWS[tramiteFlowFor(client)];
}

// Pasos para dibujar el avance: cada etapa como "hecha", "actual" o
// "siguiente". Una etapa guardada que no está en este flujo (p. ej. se
// cambió el tipo de cliente) o sin etapa todavía cuenta como la primera.
export function tramiteSteps(stages, currentStage) {
  const index = Math.max(0, stages.indexOf(currentStage));
  return stages.map((key, i) => ({ key, status: i < index ? "hecha" : i === index ? "actual" : "siguiente" }));
}

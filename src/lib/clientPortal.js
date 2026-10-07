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

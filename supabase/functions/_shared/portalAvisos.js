// Avisos por correo al cliente del portal de documentos — funciones puras, sin Deno ni Supabase, para
// probarlas con vitest. Las usa la función portal-avisos:
//  · «etapa»: el asesor movió el trámite a otra etapa (lo dispara un trigger de client_tramites);
//  · «recordatorios»: documentos que le siguen faltando al cliente (los dispara pg_cron una vez al día).
//
// Solo se avisa a clientes cuyo asesor activó «Avisar por correo» en su trámite (client_tramites.notify_client,
// apagado por omisión) y que tienen correo y un enlace de portal vigente.
//
// La lista de pendientes y los textos de las etapas están DUPLICADOS de src/lib/clientPortal.js y
// src/i18n/locales/es.json (una función de Supabase no puede importar desde src/): portalAvisos.test.js
// compara ambos lados y falla si dejan de coincidir.

import { DEFAULT_SITE_URL, esc, firstName, renderHtml, stripLines } from "./visitEmail.js";

export { DEFAULT_SITE_URL };

// Cuántos recordatorios como máximo por etapa y cada cuántos días (ver portal_claim_reminder en schema.sql).
export const MAX_REMINDERS = 3;
export const REMINDER_EVERY_DAYS = 7;

export const PORTAL_DOC_TYPES = ["ine", "curp", "acta_nacimiento", "cedula_fiscal", "escrituras", "predial", "agua", "luz", "cuenta_bancaria"];

export const DOC_LABELS = {
  ine: "INE",
  curp: "CURP",
  cedula_fiscal: "RFC (Cédula fiscal)",
  acta_nacimiento: "Acta de nacimiento",
  escrituras: "Escrituras",
  predial: "Predial",
  agua: "Agua",
  luz: "Luz",
  cuenta_bancaria: "Cuenta bancaria",
};

export const STAGES = {
  documentos: { title: "Documentos", body: "Estamos reuniendo tus documentos. Revisa tus pendientes abajo." },
  revision: { title: "Revisión", body: "Tu asesor está revisando tus documentos y tu expediente." },
  promocion: { title: "Promoción", body: "Tu propiedad ya se está anunciando y mostrando a compradores." },
  oferta: { title: "Oferta", body: "Hay una oferta por tu propiedad y estamos negociando las condiciones." },
  avaluo: { title: "Avalúo", body: "Se está haciendo el avalúo de la propiedad que pide el crédito." },
  credito: { title: "Autorización del crédito", body: "Tu crédito está en trámite con la institución; te avisamos en cuanto lo autoricen." },
  firma: { title: "Firma", body: "Estamos preparando la firma de escrituras. Tu asesor te confirmará el día y la notaría." },
  entrega: { title: "Entrega", body: "¡Último paso! Entrega de llaves y cierre del trámite." },
};

const DEFAULT_DOCS_BY_CLIENT_TYPE = {
  comprador: ["ine", "curp", "acta_nacimiento", "cedula_fiscal"],
  vendedor: ["ine", "curp", "acta_nacimiento", "cedula_fiscal", "escrituras", "predial", "agua", "luz"],
};

export function defaultRequestedDocs(clientType) {
  if (clientType === "ambos") {
    const union = new Set([...DEFAULT_DOCS_BY_CLIENT_TYPE.comprador, ...DEFAULT_DOCS_BY_CLIENT_TYPE.vendedor]);
    return PORTAL_DOC_TYPES.filter((d) => union.has(d));
  }
  return DEFAULT_DOCS_BY_CLIENT_TYPE[clientType] || DEFAULT_DOCS_BY_CLIENT_TYPE.comprador;
}

export function requestedDocsFor(tramite, clientType) {
  const saved = Array.isArray(tramite?.requested_docs) ? tramite.requested_docs : null;
  if (!saved || saved.length === 0) return defaultRequestedDocs(clientType);
  return PORTAL_DOC_TYPES.filter((d) => saved.includes(d));
}

const latest = (docs, docType) =>
  (docs || []).filter((d) => d.doc_type === docType).sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0] || null;

// Estado de un documento (mismas reglas que clientPortal.js): pendiente | corregir | en_revision | aprobado | recibido.
function docState(doc) {
  if (!doc) return "pendiente";
  if (doc.source && doc.source !== "client_portal") return "recibido";
  if (doc.review_status === "valido") return "aprobado";
  if (doc.review_status === "rechazado") return "corregir";
  return "en_revision";
}

// Lo que todavía le toca hacer al cliente, a partir de lo que devuelve portal_token_status(): primero lo que hay
// que corregir y luego lo que falta. [{ docType, state: "corregir" | "pendiente" }]
export function pendingDocs(status) {
  const requested = requestedDocsFor(status?.tramite, status?.client_type);
  const items = requested.map((docType) => {
    const portalDoc = latest(status?.documents, docType);
    const officeDoc = latest(status?.office_documents, docType);
    let doc = portalDoc || (officeDoc ? { ...officeDoc, source: officeDoc.source || "admin_capture" } : null);
    if (portalDoc && officeDoc && new Date(officeDoc.captured_at) > new Date(portalDoc.captured_at)) doc = { ...officeDoc, source: officeDoc.source || "admin_capture" };
    return { docType, state: docState(doc) };
  });
  return [...items.filter((i) => i.state === "corregir"), ...items.filter((i) => i.state === "pendiente")];
}

export const portalUrl = (siteUrl, token) => `${siteUrl}/documentos/${token}`;

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
export const canNotify = (client, token) => Boolean(client && client.active !== false && isEmail(client.email) && token);

// Del HTML escapado al texto de verdad (para la versión en texto plano del correo).
const unescapeHtml = (value) =>
  String(value).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function render(spec, greeting) {
  const details = spec.details || [];
  const html = renderHtml({ preheader: spec.preheader, heading: spec.heading, greeting, lines: spec.lines, details, buttons: spec.buttons, footnote: spec.footnote });
  const text = [
    spec.heading,
    "",
    greeting,
    ...stripLines(spec.lines).map(unescapeHtml),
    "",
    ...details.map(([l, v]) => `${l}: ${unescapeHtml(v)}`),
    "",
    ...spec.buttons.map((b) => `${b.label}: ${b.href}`),
    "",
    spec.footnote,
    "ACL Propiedades · Torreón, Gómez Palacio y Lerdo",
  ].join("\n");
  return { subject: spec.subject, html, text };
}

const FOOTNOTE = "Recibes este correo porque tu asesor de ACL Propiedades activó los avisos de tu trámite. Si prefieres no recibirlos, avísale y los desactiva.";

/** Correo de «tu trámite avanzó a…». `tramite`: { stage, note }. `note` es el mensaje que el asesor escribió para el cliente. */
export function buildStageEmail({ client, tramite, token, siteUrl = DEFAULT_SITE_URL }) {
  const stage = STAGES[tramite?.stage];
  if (!stage) throw new Error(`Etapa desconocida: ${tramite?.stage}`);
  const greeting = firstName(client?.name) ? `Hola, ${firstName(client.name)}.` : "Hola.";
  const lines = [esc(stage.body)];
  if (tramite?.note) lines.push(`<strong>Mensaje de tu asesor:</strong> ${esc(tramite.note)}`);
  return render(
    {
      subject: `Tu trámite avanzó: ${stage.title}`,
      preheader: `Ahora estás en la etapa «${stage.title}».`,
      heading: "Tu trámite avanzó",
      lines,
      details: [["Etapa actual", esc(stage.title)]],
      buttons: [{ href: portalUrl(siteUrl, token), label: "Ver cómo va mi trámite", primary: true }],
      footnote: FOOTNOTE,
    },
    greeting
  );
}

/** Correo de «te faltan estos documentos». `pending`: lo que devuelve pendingDocs(). */
export function buildReminderEmail({ client, pending, token, siteUrl = DEFAULT_SITE_URL }) {
  const greeting = firstName(client?.name) ? `Hola, ${firstName(client.name)}.` : "Hola.";
  const fix = pending.filter((p) => p.state === "corregir").length;
  const total = pending.length;
  const list = pending.map((p) => `${DOC_LABELS[p.docType] || p.docType}${p.state === "corregir" ? " (hay que volver a subirlo)" : ""}`);
  return render(
    {
      subject: total === 1 ? "Te falta 1 documento para avanzar con tu trámite" : `Te faltan ${total} documentos para avanzar con tu trámite`,
      preheader: "Súbelos desde tu portal; solo toma unos minutos.",
      heading: "Te falta poco para avanzar",
      lines: [
        fix > 0
          ? "Estos son los documentos que todavía necesitamos de ti; algunos hay que volver a subirlos porque tu asesor te dejó una observación."
          : "Estos son los documentos que todavía necesitamos de ti para seguir con tu trámite.",
      ],
      details: list.map((item, i) => [i === 0 ? "Pendientes" : "", esc(item)]),
      buttons: [{ href: portalUrl(siteUrl, token), label: "Subir mis documentos", primary: true }],
      footnote: FOOTNOTE,
    },
    greeting
  );
}

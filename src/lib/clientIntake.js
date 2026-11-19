// Enlace para que el cliente mismo capture sus datos (/registro/<token>). Funciones puras: el panel del asesor (generar y mandar el
// enlace), la página pública y los dos backends las comparten. El SQL (client_intake_submit, migración 0116) repite las mismas
// validaciones — aquí solo sirven para avisarle al cliente antes de enviar.
//
// El TIPO (comprador / vendedor / ambos) lo elige el asesor al crear el enlace; el cliente no lo ve ni lo cambia. Según el tipo se
// le piden unos datos u otros, igual que en el expediente del cliente (clientExpedienteFields.js).
import { CLIENT_BUYER_FIELDS, CLIENT_COMPANY_FIELDS, CLIENT_PERSONAL_FIELDS, CLIENT_REFERENCE_FIELDS, CLIENT_SELLER_FIELDS } from "./clientExpedienteFields";
import { generatePortalToken, PORTAL_TOKEN_PATTERN } from "./clientPortal";
import { whatsappDigits, whatsappUrl } from "./format";
import { OFFICE } from "./office";

export const INTAKE_TOKEN_PATTERN = PORTAL_TOKEN_PATTERN; // 32 hex (128 bits), igual que los demás enlaces
export const INTAKE_VALID_DAYS = 7; // vigencia (igual que el valor por omisión de expires_at en la tabla)
export const INTAKE_LABEL_MAX = 120;
export const INTAKE_TYPES = ["comprador", "vendedor", "ambos"];

// Versión del aviso de privacidad que acepta el cliente; es la misma del portal de documentos (si el aviso cambia, se sube allá).
export { PORTAL_CONSENT_VERSION as INTAKE_CONSENT_VERSION } from "./clientPortal";

export const generateIntakeToken = generatePortalToken;
export const intakeUrl = (origin, token) => `${origin}/registro/${token}`;

const DAY_MS = 864e5;
export const intakeExpiry = (now = new Date()) => new Date(now.getTime() + INTAKE_VALID_DAYS * DAY_MS).toISOString();

// revoked (el asesor lo desactivó) | used (el cliente ya lo llenó) | expired (venció) | pending (vigente, sin llenar)
export function intakeState(link, now = new Date()) {
  if (link.revoked_at) return "revoked";
  if (link.submitted_at) return "used";
  const expires = link.expires_at ? new Date(link.expires_at).getTime() : null;
  if (expires != null && !Number.isNaN(expires) && expires < now.getTime()) return "expired";
  return "pending";
}

// Texto de WhatsApp ya escrito para mandar el enlace.
export function intakeMessage(url, { name = "" } = {}) {
  const first = String(name).trim().split(/\s+/)[0];
  return `Hola${first ? ` ${first}` : ""}, soy de ACL Propiedades. Para abrir tu expediente, llena tus datos en este enlace (es seguro, tarda 3 minutos y vence en ${INTAKE_VALID_DAYS} días): ${url}`;
}

// Qué se le pide al cliente según el tipo. NO se pide la contraseña del portal de crédito (eso lo captura el equipo) ni la
// identificación del derechohabiente: son del trámite, no del registro. Los campos de comprador (NSS, empresa, referencias) solo
// salen si el cliente es comprador o ambos; el número de crédito, si es vendedor o ambos.
export function intakeGroups(type) {
  const groups = [{ key: "personal", title: "Datos personales", fields: CLIENT_PERSONAL_FIELDS }];
  if (type !== "vendedor") {
    groups.push({ key: "credito", title: "Datos del crédito", fields: CLIENT_BUYER_FIELDS.filter((f) => !f.sensitive) });
    groups.push({ key: "empresa", title: "Datos de la empresa donde trabajas", fields: CLIENT_COMPANY_FIELDS });
    groups.push({ key: "referencias", title: "Referencias personales", fields: CLIENT_REFERENCE_FIELDS });
  }
  if (type !== "comprador") groups.push({ key: "venta", title: "Datos de la venta", fields: CLIENT_SELLER_FIELDS });
  return groups;
}

export const intakeFieldKeys = (type) => intakeGroups(type).flatMap((g) => g.fields.map((f) => f.key));

export const emptyIntakeForm = (type) => ({ name: "", phone: "", email: "", ...Object.fromEntries(intakeFieldKeys(type).map((key) => [key, ""])) });

// A qué campo apunta cada código de error del servidor (para marcarlo en la pantalla); los demás errores no tienen campo.
export const INTAKE_ERROR_FIELDS = {
  name_required: "name",
  phone_invalid: "phone",
  email_invalid: "email",
  rfc_invalid: "rfc",
  curp_invalid: "curp",
  date_invalid: "fecha_nacimiento",
  civil_invalid: "estado_civil",
  consent_required: "consent",
};

const RFC = /^[A-ZÑ&]{4}[0-9]{6}[A-Z0-9]{3}$/;
const CURP = /^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{2}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const todayIso = (now) => now.toISOString().slice(0, 10);

// Primer error del formulario como { field, code } (code = intake.errors.<code> en i18n), o null si está bien. Los mismos códigos
// que regresa client_intake_submit.
export function validateIntake(form, { consent = false, now = new Date() } = {}) {
  const name = String(form.name || "").trim();
  if (name.length < 3) return { field: "name", code: "name_required" };
  if (String(form.phone || "").replace(/\D/g, "").length < 10) return { field: "phone", code: "phone_invalid" };
  const email = String(form.email || "").trim();
  if (email && !EMAIL.test(email)) return { field: "email", code: "email_invalid" };
  const birth = String(form.fecha_nacimiento || "").trim();
  if (birth && (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || birth > todayIso(now) || birth < "1900-01-01")) return { field: "fecha_nacimiento", code: "date_invalid" };
  const rfc = String(form.rfc || "").trim().toUpperCase();
  if (rfc && !RFC.test(rfc)) return { field: "rfc", code: "rfc_invalid" };
  const curp = String(form.curp || "").trim().toUpperCase();
  if (curp && !CURP.test(curp)) return { field: "curp", code: "curp_invalid" };
  if (!consent) return { field: "consent", code: "consent_required" };
  return null;
}

// Lo que se manda al servidor: solo los campos de la lista del tipo, recortados y sin vacíos (el servidor también filtra).
export function intakePayload(form, type) {
  const keys = ["name", "phone", "email", ...intakeFieldKeys(type)];
  const out = {};
  for (const key of keys) {
    let value = String(form[key] ?? "").trim();
    if (!value) continue;
    if (key === "rfc" || key === "curp") value = value.toUpperCase();
    out[key] = value;
  }
  return out;
}

// Al terminar, el cliente puede avisarle al asesor que ya llenó su registro: WhatsApp con el mensaje escrito. Va al asesor que generó
// el enlace (su WhatsApp o, si no tiene, su teléfono); sin asesor, o si su número no sirve, a la oficina.
export function intakeAdvisorContact(advisor) {
  const phone = [advisor?.whatsapp, advisor?.phone].find((value) => whatsappDigits(value).length >= 10);
  return phone ? { name: advisor.name || OFFICE.name, phone } : { name: OFFICE.name, phone: OFFICE.whatsapp, isOffice: true };
}

export function intakeAdvisorUrl(advisor, clientName) {
  const contact = intakeAdvisorContact(advisor);
  const first = String(contact.name).trim().split(/\s+/)[0];
  const text = `Hola${contact.isOffice ? "" : ` ${first}`}, soy ${String(clientName || "").trim() || "tu cliente"}. Ya llené mi registro con mis datos.`;
  return whatsappUrl(contact.phone, text);
}

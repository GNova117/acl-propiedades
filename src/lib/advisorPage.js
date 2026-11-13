// Página pública y tarjeta digital del asesor (/asesor/<slug>): su enlace, la tarjeta de contacto para guardar en el teléfono (.vcf),
// el mensaje para compartirla y qué propiedades suyas se muestran. Funciones puras.
//
// El enlace usa un `slug` que se genera una sola vez con el nombre y ya no cambia (aunque el asesor cambie de nombre o de puesto,
// el QR impreso y los enlaces mandados siguen sirviendo). En Supabase lo pone un trigger de la tabla advisors; en el modo demo se
// calcula al leer (assignSlugs), con la misma regla.

import { whatsappDigits } from "./format";

export const ADVISOR_PATH = "/asesor";
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ORG = "ACL Propiedades";

// «Ana María Pérez» → «ana-maria-perez». Sin letras ni números queda «asesor».
export function advisorSlug(name) {
  const slug = String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "asesor";
}

// Asesores con `slug` único: conserva el que ya traen y a los demás les saca uno del nombre (con -2, -3… si se repite), en el
// orden en que vienen.
export function assignSlugs(advisors) {
  const taken = new Set((advisors || []).map((a) => a.slug).filter(Boolean));
  return (advisors || []).map((advisor) => {
    if (advisor.slug) return advisor;
    const base = advisorSlug(advisor.name);
    let slug = base;
    for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`;
    taken.add(slug);
    return { ...advisor, slug };
  });
}

// El enlace de su página, o null si todavía no tiene slug.
export const advisorUrl = (advisor, origin) => (advisor?.slug ? `${origin}${ADVISOR_PATH}/${advisor.slug}` : null);

// Solo se publica la página de quien está activo y se muestra en el equipo (el asesor «de respaldo» de la oficina, por ejemplo, no).
export const isPublicAdvisor = (advisor) => Boolean(advisor) && advisor.active !== false && advisor.show_in_team !== false;

// Las propiedades de este asesor que se pueden mostrar: disponibles y activas, las más nuevas primero.
export function advisorProperties(properties, advisorId) {
  return (properties || [])
    .filter((p) => p.status === "disponible" && p.active !== false)
    .filter((p) => (p.advisors || []).some((a) => a.id === advisorId) || (p.advisor_ids || []).includes(advisorId))
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}

// Teléfono con lada de país para la tarjeta de contacto: 10 dígitos → +52…; ya con lada, tal cual. null si no hay dígitos.
export function e164(phone) {
  const digits = whatsappDigits(phone);
  if (!digits) return null;
  return `+${digits.length === 10 ? `52${digits}` : digits}`;
}

// vCard 3.0: se escapan la diagonal invertida, el punto y coma y la coma, y los saltos de línea van como «\\n».
const escapeVCard = (value) =>
  String(value ?? "")
    .replace(/\r?\n/g, "\n")
    .replace(/[\\;,]/g, (char) => `\\${char}`)
    .replace(/\n/g, "\\n");

// Tarjeta de contacto (vCard 3.0) para guardar al asesor en el teléfono: nombre, empresa, puesto (su descripción breve), teléfonos,
// correo y el enlace de su página. Líneas con CRLF, como pide el formato.
export function buildVCard(advisor, { url } = {}) {
  const name = String(advisor?.name || "").trim();
  const parts = name.split(/\s+/);
  const family = parts.length > 1 ? parts.slice(1).join(" ") : "";
  const given = parts[0] || "";
  const phone = e164(advisor?.phone);
  const whatsapp = e164(advisor?.whatsapp);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
    `FN:${escapeVCard(name)}`,
    `ORG:${escapeVCard(ORG)}`,
    advisor?.bio ? `TITLE:${escapeVCard(String(advisor.bio).trim())}` : null,
    phone ? `TEL;TYPE=CELL,VOICE:${phone}` : null,
    whatsapp && whatsapp !== phone ? `TEL;TYPE=CELL:${whatsapp}` : null,
    advisor?.email ? `EMAIL;TYPE=INTERNET,WORK:${escapeVCard(advisor.email)}` : null,
    url ? `URL:${url}` : null,
    "END:VCARD",
  ].filter(Boolean);
  return `${lines.join("\r\n")}\r\n`;
}

export const vcardFileName = (advisor) => `${advisorSlug(advisor?.name)}.vcf`;

// Mensaje para mandar su tarjeta por WhatsApp o por donde sea.
export function advisorShareText(advisor, url) {
  return `Soy ${String(advisor?.name || "").trim()}, asesor de ${ORG}. Aquí está mi tarjeta con mis propiedades y mis datos de contacto: ${url}`;
}

// WhatsApp del asesor con un saludo ya escrito (el que ve quien entra a su página).
export function advisorWhatsappHref(advisor, text = "") {
  let digits = whatsappDigits(advisor?.whatsapp || advisor?.phone);
  if (!digits) return null;
  if (digits.length === 10) digits = `52${digits}`;
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

// Saludo ya escrito para quien le escribe por WhatsApp desde su página (va al asesor, así que siempre es español).
export function advisorGreeting(advisor) {
  const first = String(advisor?.name || "").trim().split(/\s+/)[0];
  return `Hola${first ? ` ${first}` : ""}, vi tu tarjeta de ACL Propiedades y quiero más información.`;
}

// A dónde lleva el QR de su tarjeta: su página con parámetros de campaña (Google Analytics, si está activo, lo cuenta como visita
// por QR de esa tarjeta; no cambia la página que se abre).
export function advisorQrUrl(advisor, origin) {
  const url = advisorUrl(advisor, origin);
  return url ? `${url}?utm_source=qr&utm_medium=tarjeta&utm_campaign=${encodeURIComponent(advisor.slug)}` : null;
}

// Envío puntual de UN correo por una acción del staff (informe al vendedor en Visitas, desglose en
// Gastos). La lógica vive aquí, con las dependencias inyectadas, para probarla sin Deno.
//
// Por qué no basta con "Enforce JWT Verification": la llave anon del sitio público también es un JWT
// válido para el gateway de Supabase, así que cualquiera podía mandar correos con HTML y adjuntos
// arbitrarios desde avisos@aclpropiedades.com. Aquí se exige además una sesión de un usuario real
// (no la llave anon) cuyo rol tenga el apartado 'visitas' o 'gastos' — los dos lugares del panel que
// mandan correo —, un solo destinatario, tamaños acotados y un tope por hora por usuario.

const EMAIL_RE = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export const EMAIL_SECTIONS = ["visitas", "gastos"];
export const LIMITS = {
  maxToLength: 254,
  maxSubjectLength: 200,
  maxHtmlLength: 500_000,
  maxAttachmentBase64Length: 10_000_000, // ≈ 7.5 MB de archivo
  perUserPerHour: 30,
};

const fail = (status, error) => ({ status, body: { error } });

export function bearerToken(authorization) {
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization ?? "").trim());
  return match ? match[1] : null;
}

// Devuelve { error } o { value } con el contenido ya limpio.
export function validateEmailPayload(payload, limits = LIMITS) {
  if (!payload || typeof payload !== "object") return { error: "JSON inválido" };
  const to = String(payload.to ?? "").trim();
  const subject = String(payload.subject ?? "").trim();
  const html = String(payload.html ?? "");
  if (!to || !subject || !html) return { error: "Faltan to/subject/html" };
  if (to.length > limits.maxToLength || !EMAIL_RE.test(to)) return { error: "Destinatario inválido: debe ser un solo correo" };
  if (subject.length > limits.maxSubjectLength || /[\r\n]/.test(subject)) return { error: "Asunto inválido" };
  if (html.length > limits.maxHtmlLength) return { error: "El contenido es demasiado grande" };

  const value = { to, subject, html, attachments: [] };
  const attachment = payload.attachment;
  if (attachment?.filename || attachment?.contentBase64) {
    const filename = String(attachment.filename ?? "").trim();
    const content = String(attachment.contentBase64 ?? "");
    const hasControlChars = [...filename].some((char) => char.charCodeAt(0) < 32);
    if (hasControlChars || !/^[^\\/:*?"<>|]{1,150}\.pdf$/i.test(filename)) return { error: "Adjunto inválido: solo se permite un PDF" };
    if (!content || content.length > limits.maxAttachmentBase64Length || !BASE64_RE.test(content)) return { error: "Adjunto inválido o demasiado grande" };
    value.attachments.push({ filename, content });
  }
  return { value };
}

// Devuelve { status, body }. Lanza solo si falla el envío (el servidor responde 502/500).
export async function handleStaffEmail({ authorization, payload }, { getUser, hasSection, countRecent, logSend, sendEmail, limits = LIMITS }) {
  const token = bearerToken(authorization);
  if (!token) return fail(401, "unauthorized");
  const user = await getUser(token);
  // La llave anon no corresponde a ningún usuario: getUser devuelve nulo y se corta aquí.
  if (!user?.email) return fail(401, "unauthorized");

  let allowed = false;
  for (const section of EMAIL_SECTIONS) {
    if (await hasSection(section)) {
      allowed = true;
      break;
    }
  }
  if (!allowed) return fail(403, "forbidden");

  const checked = validateEmailPayload(payload, limits);
  if (checked.error) return fail(400, checked.error);

  if ((await countRecent(user.email)) >= limits.perUserPerHour) return fail(429, "rate_limited");

  const sent = await sendEmail(checked.value);
  await logSend(user.email, checked.value.to);
  return { status: 200, body: { ok: true, id: sent?.id ?? null } };
}

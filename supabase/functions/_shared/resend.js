// Envío de un correo por Resend. `fetchImpl` se puede cambiar en las pruebas.
// Lanza si Resend rechaza el envío (el que llama decide si reintenta o lo registra).
const RESEND_URL = "https://api.resend.com/emails";
export const DEFAULT_FROM = "ACL Propiedades <avisos@aclpropiedades.com>";

export async function sendResendEmail({ apiKey, from, to, subject, html, text, attachments }, fetchImpl = fetch) {
  const body = { from: from || DEFAULT_FROM, to, subject, html, text };
  if (attachments && attachments.length > 0) body.attachments = attachments.map((a) => ({ filename: a.filename, content: a.content }));
  const res = await fetchImpl(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend: ${JSON.stringify(data)}`);
  return data;
}

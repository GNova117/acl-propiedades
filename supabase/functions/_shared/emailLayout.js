// Plantilla ÚNICA de los correos de ACL Propiedades: encabezado de marca, contenido, botones y pie. Todos los correos del
// sistema (visitas, avisos del portal, alertas de propiedades, resumen semanal) pasan por aquí para que se vean iguales.
// Solo HTML con tablas y estilos en línea (así lo leen bien Gmail, Outlook y los teléfonos); sin imágenes externas.
export const BRAND = "#1565c0";
export const TEXT = "#12161c";
export const MUTED = "#5a6472";
export const BUSINESS_FOOTER = "ACL Propiedades · Torreón, Gómez Palacio y Lerdo";

export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const paragraph = (html) => `<p style="margin:0 0 14px;font-size:15px;color:${TEXT};line-height:1.5">${html}</p>`;

function buttonsHtml(buttons) {
  return buttons
    .map(
      (b) =>
        `<a href="${escapeHtml(b.href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;${b.primary ? `background:${BRAND};color:#ffffff;border:1px solid ${BRAND}` : `background:#ffffff;color:${BRAND};border:1px solid ${BRAND}`}">${escapeHtml(b.label)}</a>`,
    )
    .join("");
}

function detailsHtml(details) {
  if (!details.length) return "";
  const rows = details
    .map(([label, value]) => `<tr><td style="padding:6px 12px 6px 0;color:${MUTED};font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;color:${TEXT};font-size:15px;font-weight:600">${value}</td></tr>`)
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 18px">${rows}</table>`;
}

/**
 * Arma el correo completo.
 *   preheader: línea de vista previa · heading: título · greeting: saludo (opcional)
 *   lines: párrafos YA en HTML (quien llama escapa lo suyo) · body: HTML libre extra (tablas, listas), opcional
 *   details: [[etiqueta, valorHtml]] · buttons: [{ href, label, primary }] · footnote: texto del pie (se escapa)
 *   footerHtml: HTML extra al final del pie (p. ej. el enlace de baja), opcional · maxWidth: ancho de la tarjeta (560 por omisión)
 */
export function renderEmail({ preheader = "", heading, greeting = "", lines = [], body = "", details = [], buttons = [], footnote = "", footerHtml = "", maxWidth = 560 }) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${Number(maxWidth) || 560}px;background:#ffffff;border-radius:12px;border:1px solid #e2e6ec">
<tr><td style="padding:20px 28px;border-bottom:3px solid ${BRAND};font-size:18px;font-weight:700;color:${BRAND}">ACL Propiedades</td></tr>
<tr><td style="padding:24px 28px 8px">
<h1 style="margin:0 0 12px;font-size:21px;color:${TEXT}">${escapeHtml(heading)}</h1>
${greeting ? paragraph(escapeHtml(greeting)) : ""}${lines.map(paragraph).join("")}${body}${detailsHtml(details)}${buttons.length ? `<div style="margin:0 0 8px">${buttonsHtml(buttons)}</div>` : ""}
</td></tr>
<tr><td style="padding:12px 28px 24px;font-size:13px;color:${MUTED};line-height:1.5">${footnote ? `${escapeHtml(footnote)}<br>` : ""}${footerHtml ? `${footerHtml}<br>` : ""}${BUSINESS_FOOTER}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Para los correos sueltos que arma el panel (enviar-correo): si el HTML ya es un documento completo se respeta; si es solo un
 * fragmento (`<p>…</p>`), se pone dentro de la plantilla con el asunto como título. Así ningún correo sale «pelón».
 */
export function brandedHtml(subject, html) {
  if (/^\s*<(!doctype|html)\b/i.test(String(html))) return html;
  return renderEmail({ preheader: subject, heading: subject, body: `<div style="font-size:15px;color:${TEXT};line-height:1.5">${html}</div>` });
}

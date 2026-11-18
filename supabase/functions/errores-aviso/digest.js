// Correo con los errores nuevos del navegador (tabla client_errors) para los administradores. Puro (sin red ni base de
// datos) para poder probarlo con vitest; index.ts lee la tabla, manda el correo y marca los errores como avisados.
import { escapeHtml, renderEmail } from "../_shared/emailLayout.js";

export const MAX_ERRORS_IN_EMAIL = 15;

// Destinatarios: ERRORS_REPORT_TO (lista separada por comas) si existe; si no, los correos cuyo rol tiene el apartado
// «roles» (los administradores, los mismos que ven /admin/errores).
export function adminRecipients(accessRows, override) {
  const emails = override
    ? String(override).split(",")
    : (accessRows || [])
        .filter((row) => {
          const role = Array.isArray(row.admin_roles) ? row.admin_roles[0] : row.admin_roles;
          return role?.sections?.includes("roles");
        })
        .map((row) => row.email);
  return Array.from(new Set(emails.map((e) => String(e || "").trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))));
}

const oneLine = (text, max) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);

// errors: filas de client_errors (más recientes primero). → { subject, html, text } o null si no hay nada que avisar.
export function buildErrorDigest(errors, { siteUrl }) {
  const list = errors || [];
  if (list.length === 0) return null;
  const shown = list.slice(0, MAX_ERRORS_IN_EMAIL);
  const extra = list.length - shown.length;
  const reports = list.filter((e) => e.source === "usuario").length;
  const subject =
    reports === list.length
      ? list.length === 1
        ? "Una persona del equipo reportó un problema en ACL Propiedades"
        : `${list.length} reportes de problemas del equipo en ACL Propiedades`
      : reports === 0
        ? list.length === 1
          ? "Error nuevo en el sitio de ACL Propiedades"
          : `${list.length} errores nuevos en el sitio de ACL Propiedades`
        : `${list.length} avisos nuevos en ACL Propiedades (${list.length - reports} errores y ${reports} reportes del equipo)`;

  const rows = shown
    .map(
      (e) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #e2e6ec;font-size:14px">${
          e.source === "usuario" ? `<span style="color:#1565c0;font-size:13px;font-weight:700">Reporte de ${escapeHtml(e.reported_by || "alguien del equipo")}</span><br>` : ""
        }<strong>${escapeHtml(oneLine(e.message, e.source === "usuario" ? 400 : 160))}</strong><br>` +
        `<span style="color:#5a6472;font-size:13px">${escapeHtml(e.url || "/")}${
          e.source === "usuario" ? "" : ` · ${escapeHtml(String(e.count))} vez/veces`
        }${e.release ? ` · versión ${escapeHtml(e.release)}` : ""}</span></td></tr>`,
    )
    .join("");
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px">${rows}</table>${
    extra > 0 ? `<p style="margin:0 0 14px;font-size:14px;color:#5a6472">…y ${extra} más en el panel.</p>` : ""
  }`;

  const html = renderEmail({
    preheader: subject,
    heading: subject,
    lines: ["Los visitantes o el equipo se toparon con esto, o alguien del equipo lo reportó con el botón «Reportar un problema». Los errores se agrupan por tipo."],
    body,
    buttons: [{ href: `${siteUrl}/admin/errores`, label: "Ver los errores", primary: true }],
    footnote: "Este aviso sale cuando aparece un error nuevo, uno resuelto vuelve a pasar o alguien del equipo manda un reporte.",
  });
  const text = [subject, "", ...shown.map((e) => (e.source === "usuario" ? `- Reporte de ${e.reported_by || "alguien del equipo"}: ${oneLine(e.message, 400)} (${e.url || "/"})` : `- ${oneLine(e.message, 160)} (${e.url || "/"}, ${e.count} vez/veces)`)), ...(extra > 0 ? [`…y ${extra} más`] : []), "", `${siteUrl}/admin/errores`].join("\n");
  return { subject, html, text };
}

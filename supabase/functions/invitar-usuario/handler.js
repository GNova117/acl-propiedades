// Invitación por correo a alguien a quien ya se le dio acceso en Roles (admin_access): Supabase le manda un enlace para
// elegir su contraseña (abre /admin/restablecer) y así no hay que crear la cuenta a mano en el panel de Supabase.
// Quien llama debe ser una persona con el apartado Roles. Solo se invita un correo que YA tiene acceso (no se puede usar
// para mandar invitaciones a cualquiera). La lógica está aquí, con las dependencias inyectadas, para probarla sin Deno.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DEFAULT_SITE_URL = "https://acl-propiedades.vercel.app";

// → { status, body }. `authorize()` → true si quien llama tiene el apartado Roles (con su propia sesión);
// `hasAccess(email)` → true si ese correo está en admin_access; `invite(email, redirectTo)` → { error?: { message, status?, code? } }.
export async function handleInvite({ email } = {}, { authorize, hasAccess, invite, siteUrl = DEFAULT_SITE_URL }) {
  if (!(await authorize())) return { status: 403, body: { error: "forbidden" } };
  const to = String(email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(to) || to.length > 254) return { status: 400, body: { error: "invalid_email" } };
  if (!(await hasAccess(to))) return { status: 404, body: { error: "no_access_row" } };

  const result = await invite(to, `${String(siteUrl).replace(/\/+$/, "")}/admin/restablecer`);
  if (result?.error) {
    // Ya tiene cuenta: no es un fallo; se le puede mandar «Olvidé mi contraseña» si la necesita.
    if (result.error.code === "email_exists" || result.error.status === 422 || /already.*registered|already.*exists/i.test(result.error.message || "")) {
      return { status: 200, body: { ok: true, alreadyHasAccount: true } };
    }
    return { status: 502, body: { error: "invite_failed" } };
  }
  return { status: 200, body: { ok: true, alreadyHasAccount: false } };
}

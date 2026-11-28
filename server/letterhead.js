// Entrega de la hoja membretada (ver src/lib/letterhead.js y api/plantilla.js). La lógica vive aquí, con las
// dependencias inyectadas, para probarla sin Vercel. Solo la reciben las personas con sesión de Supabase Auth cuyo rol
// tenga el apartado `membrete` (la misma función has_admin_section que usan las políticas RLS).
export const LETTERHEAD_SECTION = "membrete";

// Devuelve { status, body?, headers? }. `readTemplate` lee el PDF del disco.
export async function handleLetterheadRequest({ authorization }, { getUser, hasSection, readTemplate }) {
  const match = /^Bearer\s+(.+)$/i.exec(String(authorization ?? "").trim());
  if (!match) return { status: 401, json: { error: "unauthorized" } };
  const user = await getUser(match[1]);
  // La llave anon del sitio no pertenece a ningún usuario: getUser devuelve nulo y se corta aquí.
  if (!user?.email) return { status: 401, json: { error: "unauthorized" } };
  if (!(await hasSection(LETTERHEAD_SECTION))) return { status: 403, json: { error: "forbidden" } };
  const body = await readTemplate();
  return {
    status: 200,
    body,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(body.length),
      // Privado: que ningún CDN la guarde; el navegador la puede reutilizar un rato.
      "Cache-Control": "private, max-age=3600",
    },
  };
}

// Invita por correo a alguien que ya tiene acceso en Roles (ver handler.js). Se llama desde el panel con la sesión de
// quien invita: la función comprueba con ESA sesión que tenga el apartado Roles y solo entonces usa la service role key
// (inyectada por Supabase) para mandar la invitación. Se despliega con la verificación de JWT activada (la de siempre).
// Variables: SITE_URL (opcional; ver el valor por omisión en handler.js). El correo lo manda Supabase Auth, así que en
// Authentication → URL Configuration hay que permitir como Redirect URL: https://<tu-sitio>/admin/restablecer.

import { handleInvite } from "./handler.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "forbidden" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });

  const { createClient } = await import("jsr:@supabase/supabase-js@2");
  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const payload = await req.json().catch(() => ({}));
  try {
    const result = await handleInvite(payload, {
      authorize: async () => {
        const { data, error } = await asCaller.rpc("has_admin_section", { section: "roles" });
        return !error && data === true;
      },
      hasAccess: async (email: string) => {
        const { data, error } = await admin.from("admin_access").select("id").eq("email", email).maybeSingle();
        if (error) throw new Error(error.message);
        return Boolean(data);
      },
      invite: async (email: string, redirectTo: string) => {
        const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
        return { error: error ? { message: error.message, status: error.status, code: error.code } : undefined };
      },
      siteUrl: Deno.env.get("SITE_URL") || undefined,
    });
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { ...CORS, "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
}

// Solo dentro de Deno (en las pruebas se importa handler.js y no se arranca el servidor).
// deno-lint-ignore no-explicit-any
if (typeof (globalThis as any).Deno !== "undefined") {
  // deno-lint-ignore no-explicit-any
  (globalThis as any).Deno.serve(handler);
}

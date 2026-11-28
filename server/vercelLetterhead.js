// Hoja membretada de ACL Propiedades para los PDF que se arman en el navegador (/api/plantilla → api/media.js,
// kind=plantilla). Ya no es un archivo público: solo la recibe quien tenga sesión y el apartado "Plantilla membretada"
// (membrete) en su rol (/admin/roles). Sin acceso, los PDF salen sobre una hoja en blanco (ver src/lib/letterhead.js).
// El PDF vive en server/assets/ y se incluye en la función con `includeFiles` (vercel.json); pesa ~3.7 MB, por debajo del
// tope de 4.5 MB de respuesta de Vercel. No es una función propia: el plan Hobby permite 12 por despliegue (ver media.js).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { handleLetterheadRequest } from "../server/letterhead.js";

export default async function letterheadHandler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method" });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    res.status(503).json({ error: "not_configured" });
    return;
  }

  const authorization = req.headers.authorization || "";
  // Cliente con la sesión de quien llama: así has_admin_section() evalúa auth.email() de esa persona.
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await handleLetterheadRequest(
      { authorization },
      {
        getUser: async (token) => {
          const { data, error } = await supabase.auth.getUser(token);
          return error ? null : data?.user ?? null;
        },
        hasSection: async (section) => {
          const { data, error } = await supabase.rpc("has_admin_section", { section });
          return !error && data === true;
        },
        readTemplate: () => readFile(path.join(process.cwd(), "server", "assets", "plantilla_acl.pdf")),
      },
    );
    if (result.json) {
      res.status(result.status).json(result.json);
      return;
    }
    for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
    res.status(result.status).send(result.body);
  } catch (err) {
    console.error("plantilla", err?.message);
    res.status(500).json({ error: "server_error" });
  }
}

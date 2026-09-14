// Segunda función serverless del proyecto (la primera es api/sitemap.js).
// Trae un resumen de Google Analytics 4 (visitas de los últimos 7 días +
// páginas más vistas) para mostrarlo en el Dashboard del admin, sin que
// nadie tenga que salir del panel a analytics.google.com. Las
// credenciales de Google NUNCA se mandan al navegador — viven solo aquí,
// en variables de entorno de Vercel, igual que el resto de secretos de
// este proyecto (WhatsApp, cron).
//
// Usa OAuth2 con un refresh token (no una llave de cuenta de servicio):
// el proyecto de Google Cloud de este negocio trae activada por default
// la política "Disable service account key creation" a nivel
// organización, y nadie con esa cuenta tiene el rol para desactivarla —
// bloqueo cada vez más común en cuentas nuevas de Google. OAuth2 no cae
// bajo esa restricción (aplica solo a llaves de cuentas de servicio) y
// además reusa el acceso que la propia persona ya tiene en GA4, sin
// tener que agregar una cuenta de servicio como Viewer de la propiedad.
import { createClient } from "@supabase/supabase-js";
import { OAuth2Client } from "google-auth-library";

const ANALYTICS_ENDPOINT = "https://analyticsdata.googleapis.com/v1beta";

// La ruta la puede llamar cualquiera, pero los datos solo se calculan
// para una sesión de Supabase válida — mismo nivel ("autenticado", sin
// exigir un apartado específico) que ya usan Zonas/Testimonios en RLS;
// esto no es información de clientes ni financiera, así que no amerita
// el nivel de Liquidaciones/Clientes.
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

function getGaClient() {
  const clientId = process.env.GA_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GA_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GA_OAUTH_REFRESH_TOKEN;
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!clientId || !clientSecret || !refreshToken || !propertyId) return null;

  const client = new OAuth2Client({ clientId, clientSecret });
  // Con solo el refresh token seteado, cualquier client.request() pide un
  // access token nuevo por su cuenta antes de llamar a la API — no hace
  // falta manejar la renovación a mano.
  client.setCredentials({ refresh_token: refreshToken });
  return { client, propertyId };
}

export default async function handler(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: "No autorizado" });
    return;
  }

  const ga = getGaClient();
  if (!ga) {
    res.status(200).json({ configured: false });
    return;
  }

  try {
    const { client, propertyId } = ga;
    const runReport = (body) =>
      client
        .request({
          url: `${ANALYTICS_ENDPOINT}/properties/${propertyId}:runReport`,
          method: "POST",
          data: body,
        })
        .then((r) => r.data);

    const [totals, topPages] = await Promise.all([
      runReport({
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
      }),
      runReport({
        dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
        dimensions: [{ name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 5,
      }),
    ]);

    const totalsRow = totals.rows?.[0]?.metricValues || [];
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(200).json({
      configured: true,
      activeUsers: Number(totalsRow[0]?.value || 0),
      pageViews: Number(totalsRow[1]?.value || 0),
      topPages: (topPages.rows || []).map((row) => ({
        title: row.dimensionValues[0].value,
        views: Number(row.metricValues[0].value),
      })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message || "No se pudo consultar Google Analytics" });
  }
}

// Segunda función serverless del proyecto (la primera es api/sitemap.js).
// Trae un resumen de Google Analytics 4 (visitas de los últimos 7 días +
// páginas más vistas) para mostrarlo en el Dashboard del admin, sin que
// nadie tenga que salir del panel a analytics.google.com. La credencial
// de la cuenta de servicio de Google NUNCA se manda al navegador — vive
// solo aquí, en variables de entorno de Vercel, igual que el resto de
// secretos de este proyecto (WhatsApp, cron).
import { createClient } from "@supabase/supabase-js";
import { JWT } from "google-auth-library";

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
  const email = process.env.GA_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GA_SERVICE_ACCOUNT_PRIVATE_KEY;
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!email || !privateKey || !propertyId) return null;

  const client = new JWT({
    email,
    // Vercel guarda el valor de la variable como una sola línea — los
    // saltos de línea reales de la llave privada vienen escapados como
    // "\n" literal, hay que devolverlos a saltos de línea de verdad.
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
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

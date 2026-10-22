// Tasa de referencia del mercado (TIIE 28 días, Banxico) para el comparador
// de créditos público (/comparar-creditos, ver CreditCompare.jsx). Pública
// y de solo lectura — no hay dato sensible ni gasto por consulta, así que no
// necesita sesión ni límites de abuso como api/chat.js. Cache-Control
// aprovecha el CDN de Vercel para no pegarle a Banxico en cada visita: la
// TIIE se publica una vez al día.
import { fetchReferenceRate, MortgageRateError } from "../server/mortgageRate.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method" });
    return;
  }

  if (!process.env.BANXICO_TOKEN) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ configured: false });
    return;
  }

  try {
    const { rate, asOf, seriesId } = await fetchReferenceRate({ token: process.env.BANXICO_TOKEN });
    res.setHeader("Cache-Control", "public, max-age=21600, stale-while-revalidate=86400");
    res.status(200).json({ configured: true, available: true, rate, asOf, seriesId });
  } catch (err) {
    res.setHeader("Cache-Control", "no-store");
    const code = err instanceof MortgageRateError ? err.code : "upstream";
    res.status(200).json({ configured: true, available: false, error: code });
  }
}

// Tasa de referencia del mercado (TIIE 28 días) para el comparador de
// créditos público — ver api/mortgage-rate.js y src/lib/mortgageRate.js
// (la interpretación de la respuesta, que sí tiene pruebas). Vive fuera de
// api/ por la misma razón que marketSearch.js/sketchToPlan.js: todo archivo
// en api/ es una ruta pública de Vercel, y esto es solo la llamada a Banxico.
// BANXICO_TOKEN nunca sale de aquí.
import { BANXICO_TIIE_28_SERIES_ID, parseBanxicoRateResponse } from "../src/lib/mortgageRate.js";

const BANXICO_URL = `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${BANXICO_TIIE_28_SERIES_ID}/datos/oportuno`;

export class MortgageRateError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export async function fetchReferenceRate({ token, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!token) throw new MortgageRateError("bad_key", "Falta BANXICO_TOKEN.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(BANXICO_URL, {
      headers: { Accept: "application/json", "Bmx-Token": token },
      signal: controller.signal,
    });
  } catch (err) {
    throw new MortgageRateError(err?.name === "AbortError" ? "timeout" : "upstream", err?.message || "No se pudo consultar a Banxico.");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 || res.status === 403) throw new MortgageRateError("bad_key", "El token de Banxico no es válido.");
  if (res.status === 429) throw new MortgageRateError("rate_limited", "Banxico está limitando las consultas por ahora.");
  if (!res.ok) throw new MortgageRateError("upstream", `Banxico respondió ${res.status}.`);

  const json = await res.json().catch(() => null);
  const parsed = parseBanxicoRateResponse(json);
  if (!parsed) throw new MortgageRateError("bad_output", "Banxico no publicó un dato reciente para esta serie.");
  return parsed;
}

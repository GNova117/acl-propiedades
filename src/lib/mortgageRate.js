// Tasa de referencia del mercado para el comparador de créditos
// (CreditCompare.jsx), tomada de Banxico (API SIE) — ver server/mortgageRate.js
// para la llamada real. Esta es la TIIE a 28 días, no la tasa final de un
// crédito hipotecario: los bancos le suman su propio margen encima. Se
// muestra con esa aclaración, nunca como "la tasa hipotecaria" — mismo
// cuidado que con el indicador de vistas: dato real o no se muestra nada.
export const BANXICO_TIIE_28_SERIES_ID = "SF43783";

function parseBanxicoDate(fechaStr) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(fechaStr || ""));
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

// Interpreta la respuesta de GET /series/{id}/datos/oportuno de Banxico.
// Banxico usa "N/E" en `dato` cuando no hay valor para esa fecha (fin de
// semana/feriado) — se trata igual que "sin datos", nunca se inventa un
// número para rellenar el hueco.
export function parseBanxicoRateResponse(json) {
  const serie = json?.bmx?.series?.[0];
  const punto = serie?.datos?.[0];
  if (!serie || !punto) return null;

  const rate = Number(punto.dato);
  const asOf = parseBanxicoDate(punto.fecha);
  if (!Number.isFinite(rate) || !asOf) return null;

  return { seriesId: serie.idSerie || null, rate, asOf };
}

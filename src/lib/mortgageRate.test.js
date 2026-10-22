import { describe, expect, it } from "vitest";
import { parseBanxicoRateResponse } from "./mortgageRate";

const okResponse = {
  bmx: { series: [{ idSerie: "SF43783", titulo: "TIIE a 28 días", datos: [{ fecha: "15/10/2026", dato: "8.7500" }] }] },
};

describe("parseBanxicoRateResponse", () => {
  it("extrae tasa, fecha (ISO) y serie de una respuesta válida", () => {
    expect(parseBanxicoRateResponse(okResponse)).toEqual({ seriesId: "SF43783", rate: 8.75, asOf: "2026-10-15" });
  });

  it("devuelve null cuando el dato es 'N/E' (sin publicar ese día)", () => {
    const resp = { bmx: { series: [{ idSerie: "SF43783", datos: [{ fecha: "15/10/2026", dato: "N/E" }] }] } };
    expect(parseBanxicoRateResponse(resp)).toBeNull();
  });

  it("devuelve null con una fecha mal formada", () => {
    const resp = { bmx: { series: [{ idSerie: "SF43783", datos: [{ fecha: "2026-10-15", dato: "8.75" }] }] } };
    expect(parseBanxicoRateResponse(resp)).toBeNull();
  });

  it("devuelve null sin series o sin datos", () => {
    expect(parseBanxicoRateResponse({ bmx: { series: [] } })).toBeNull();
    expect(parseBanxicoRateResponse({ bmx: { series: [{ idSerie: "SF43783", datos: [] }] } })).toBeNull();
    expect(parseBanxicoRateResponse(null)).toBeNull();
    expect(parseBanxicoRateResponse({})).toBeNull();
  });
});

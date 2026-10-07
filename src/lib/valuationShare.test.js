import { describe, expect, it } from "vitest";
import { valuationPdfLabels, valuationWhatsappUrl } from "./valuationShare";

const labels = {
  title: "Estimación de valor",
  zone: "Zona",
  reference: "Referencia",
  range: "Rango",
  center: "Valor central",
  landRate: "Terreno",
  builtRate: "Construcción",
  disclaimer: "Estimación, no un avalúo formal",
};

const data = {
  zoneName: "Centro",
  reference: "Calle 1 #23",
  landArea: 200,
  builtArea: 150,
  landRate: 1000,
  builtRate: 8000,
  result: { low: 1200000, high: 1500000, center: 1350000, landValue: 200000, builtValue: 1200000 },
};

describe("valuationWhatsappUrl", () => {
  it("antepone 52 a un número mexicano de 10 dígitos", () => {
    const url = valuationWhatsappUrl(data, "8714871494", labels);
    expect(url).toContain("https://wa.me/528714871494?text=");
  });

  it("deja igual un número que ya trae lada de país o es de otro país", () => {
    const url = valuationWhatsappUrl(data, "528714871494", labels);
    expect(url).toContain("https://wa.me/528714871494?text=");
  });

  it("sin teléfono, deja que WhatsApp pida elegir el contacto", () => {
    const url = valuationWhatsappUrl(data, "", labels);
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("omite la línea de terreno o construcción cuando esa superficie es cero", () => {
    const url = valuationWhatsappUrl({ ...data, landArea: 0 }, "", labels);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).not.toContain(labels.landRate);
    expect(text).toContain(labels.builtRate);
  });

  it("incluye el rango, el valor central y el texto va codificado para URL", () => {
    const url = valuationWhatsappUrl(data, "", labels);
    const text = decodeURIComponent(url.split("text=")[1]);
    expect(text).toContain("Rango");
    expect(text).toContain("Valor central");
    expect(url).not.toContain(" "); // el espacio debe ir codificado
  });
});

describe("valuationPdfLabels", () => {
  it("arma un objeto con todas las etiquetas traducidas", () => {
    const t = (key) => `traducido:${key}`;
    const result = valuationPdfLabels(t);
    expect(result.title).toBe("traducido:valuation.pdf.title");
    expect(result.disclaimer).toBe("traducido:valuation.pdf.disclaimer");
  });
});

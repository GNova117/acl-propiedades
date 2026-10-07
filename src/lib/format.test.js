import { describe, expect, it } from "vitest";
import {
  docTypesForClientType,
  DOC_TYPES,
  formatArea,
  formatMXN,
  isPdfDoc,
  numOrNull,
  propertyListPath,
  propertyTypeLabel,
  slugify,
  whatsappDigits,
} from "./format";

describe("numOrNull", () => {
  it("convierte cadena vacía y null/undefined a null", () => {
    expect(numOrNull("")).toBeNull();
    expect(numOrNull(null)).toBeNull();
    expect(numOrNull(undefined)).toBeNull();
  });

  it("convierte cualquier otro valor a número", () => {
    expect(numOrNull("42")).toBe(42);
    expect(numOrNull(0)).toBe(0);
  });
});

describe("whatsappDigits", () => {
  it("quita todo lo que no sea dígito, incluyendo el + y espacios", () => {
    expect(whatsappDigits("+52 871 487 1494")).toBe("528714871494");
  });

  it("devuelve cadena vacía para valores vacíos/nulos", () => {
    expect(whatsappDigits("")).toBe("");
    expect(whatsappDigits(null)).toBe("");
  });
});

describe("isPdfDoc", () => {
  it("reconoce una data URL de PDF (modo demo)", () => {
    expect(isPdfDoc({ file_path: "data:application/pdf;base64,AAAA" })).toBe(true);
  });

  it("reconoce una ruta de Supabase que termina en .pdf", () => {
    expect(isPdfDoc({ file_path: "clientes/1/contrato.pdf" })).toBe(true);
  });

  it("no confunde una URL firmada de Supabase (termina en ?token=...) con un PDF por extensión", () => {
    expect(isPdfDoc({ file_path: null, signed_url: "https://x.supabase.co/.../foto.jpg?token=abc" })).toBe(false);
  });

  it("revisa file_path antes que signed_url", () => {
    expect(isPdfDoc({ file_path: "doc.pdf", signed_url: "https://x/doc.pdf?token=abc" })).toBe(true);
  });

  it("no es PDF cuando no hay ninguna fuente", () => {
    expect(isPdfDoc({})).toBe(false);
  });
});

describe("formatMXN / formatArea", () => {
  it("formatea pesos mexicanos sin decimales", () => {
    expect(formatMXN(1500000)).toBe("$1,500,000");
  });

  it("formatMXN produce un string con el símbolo de pesos y sin valores NaN para entradas inválidas", () => {
    expect(formatMXN(undefined)).toContain("$");
    expect(formatMXN("no-es-numero")).toContain("$");
    expect(formatMXN(0)).toContain("0");
  });

  it("formatArea agrega la unidad m²", () => {
    expect(formatArea(120)).toBe("120 m²");
    expect(formatArea(undefined)).toBe("0 m²");
  });
});

describe("propertyListPath", () => {
  it("manda nave_industrial y terreno a su apartado dedicado", () => {
    expect(propertyListPath("nave_industrial")).toBe("/naves-industriales");
    expect(propertyListPath("terreno")).toBe("/terrenos");
  });

  it("cualquier otro tipo (incluido uno agregado por el admin) cae al listado general", () => {
    expect(propertyListPath("casa")).toBe("/propiedades");
    expect(propertyListPath("bodega_chica")).toBe("/propiedades");
  });
});

describe("slugify", () => {
  it("quita acentos, pasa a minúsculas y usa guión bajo como separador", () => {
    expect(slugify("Bodega Chica")).toBe("bodega_chica");
    expect(slugify("Bodegón")).toBe("bodegon");
  });

  it("quita guiones bajos sobrantes al inicio/final", () => {
    expect(slugify("  -Nave-  ")).toBe("nave");
  });
});

describe("propertyTypeLabel", () => {
  const tTranslated = (key) => (key === "propertyType.casa" ? "Casa" : key);
  const tUntranslated = (key) => key;

  it("usa la traducción i18n cuando existe", () => {
    expect(propertyTypeLabel(tTranslated, "casa")).toBe("Casa");
  });

  it("cuando no hay traducción, humaniza el slug en vez de mostrar la llave cruda", () => {
    expect(propertyTypeLabel(tUntranslated, "bodega_chica")).toBe("Bodega Chica");
  });
});

describe("docTypesForClientType", () => {
  it("un comprador no incluye documentos propios del inmueble (escrituras, predial, agua, luz)", () => {
    const docs = docTypesForClientType("comprador");
    expect(docs).not.toContain("escrituras");
    expect(docs).not.toContain("predial");
    expect(docs).toContain("solicitud_avaluo");
  });

  it("un vendedor no incluye la solicitud/pago de avalúo", () => {
    const docs = docTypesForClientType("vendedor");
    expect(docs).not.toContain("solicitud_avaluo");
    expect(docs).not.toContain("pago_avaluo");
    expect(docs).toContain("escrituras");
  });

  it("un tipo de cliente desconocido cae a la lista completa de documentos", () => {
    expect(docTypesForClientType("ambos")).toEqual(DOC_TYPES);
    expect(docTypesForClientType(undefined)).toEqual(DOC_TYPES);
  });
});

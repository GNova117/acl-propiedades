import { describe, expect, it } from "vitest";
import {
  formatDeliveryDate,
  normalizeMxWhatsapp,
  daysSince,
  docTypesForClientType,
  DOC_TYPES,
  formatArea,
  formatAreaFt2,
  formatMXN,
  statusBadgeClass,
  isPdfDoc,
  numOrNull,
  propertyListPath,
  propertyTypeLabel,
  slugify,
  whatsappDigits,
  whatsappUrl,
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

describe("whatsappUrl", () => {
  it("antepone la lada 52 a un teléfono de 10 dígitos, sin importar el formato", () => {
    expect(whatsappUrl("871 123-4567")).toBe("https://wa.me/528711234567");
  });
  it("respeta un número que ya trae lada", () => {
    expect(whatsappUrl("+52 871 123 4567")).toBe("https://wa.me/528711234567");
  });
  it("agrega el texto codificado cuando se pasa", () => {
    expect(whatsappUrl("8711234567", "Hola mundo")).toBe("https://wa.me/528711234567?text=Hola%20mundo");
  });
  it("devuelve null sin dígitos", () => {
    expect(whatsappUrl("")).toBeNull();
    expect(whatsappUrl(null)).toBeNull();
    expect(whatsappUrl("sin teléfono")).toBeNull();
  });
});

describe("formatDeliveryDate", () => {
  it("da formato a una fecha ISO y respeta el texto libre", () => {
    expect(formatDeliveryDate("2027-06-01", "es-MX")).toBe("junio de 2027");
    expect(formatDeliveryDate("2027-06", "es-MX")).toBe("junio de 2027");
    expect(formatDeliveryDate("2027-06-01", "en")).toBe("June 2027");
    expect(formatDeliveryDate("Segundo semestre 2027")).toBe("Segundo semestre 2027");
    expect(formatDeliveryDate("2027-13-01")).toBe("2027-13-01");
    expect(formatDeliveryDate(null)).toBe("");
  });
});

describe("daysSince", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  it("cuenta días enteros y nunca negativos", () => {
    expect(daysSince("2026-11-26T08:00:00Z", now)).toBe(0);
    expect(daysSince("2026-11-21T12:00:00Z", now)).toBe(5);
    expect(daysSince("2026-12-01T12:00:00Z", now)).toBe(0);
    expect(daysSince("no-es-fecha", now)).toBeNull();
    expect(daysSince(null, now)).toBeNull();
  });
});

describe("normalizeMxWhatsapp", () => {
  it("deja todo en 52 + 10 dígitos", () => {
    expect(normalizeMxWhatsapp("871 324 3271")).toBe("528713243271");
    expect(normalizeMxWhatsapp("+52 871 324 3271")).toBe("528713243271");
    expect(normalizeMxWhatsapp("5218713243271")).toBe("528713243271");
    expect(normalizeMxWhatsapp("528713243271")).toBe("528713243271");
  });
  it("un número del extranjero o vacío no se inventa", () => {
    expect(normalizeMxWhatsapp("+1 415 555 0100")).toBe("14155550100");
    expect(normalizeMxWhatsapp("")).toBe("");
    expect(normalizeMxWhatsapp(null)).toBe("");
  });
});

describe("formatAreaFt2", () => {
  it("convierte m² a pies cuadrados, redondeado", () => {
    expect(formatAreaFt2(1000)).toBe("10,764 ft²");
    expect(formatAreaFt2(1)).toBe("11 ft²");
  });
  it("valores vacíos o inválidos no muestran nada", () => {
    expect(formatAreaFt2(0)).toBe("");
    expect(formatAreaFt2(null)).toBe("");
    expect(formatAreaFt2("abc")).toBe("");
  });
});

describe("statusBadgeClass", () => {
  it("cada estatus conocido tiene su color", () => {
    expect(statusBadgeClass("disponible")).toBe("badge-available");
    expect(statusBadgeClass("apartada")).toBe("badge-reserved");
    expect(statusBadgeClass("vendida")).toBe("badge-sold");
    expect(statusBadgeClass("rentada")).toBe("badge-sold");
  });
  it("un estatus desconocido sale neutro, no rojo", () => {
    expect(statusBadgeClass("en_negociacion")).toBe("badge-neutral");
    expect(statusBadgeClass(undefined)).toBe("badge-neutral");
  });
});

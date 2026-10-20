import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SOLICITUD_CREDITO_SECTIONS } from "./solicitudCredito";
import { CELL_ROWS } from "./solicitudCreditoLayout";
import { TEXT_FIELD_MAP, RADIO_FIELD_MAP, REGIMEN_CHECKBOX_MAP, buildSolicitudCreditoPdf } from "./solicitudCreditoPdf";

// Campos que no van por TEXT_FIELD_MAP/RADIO_FIELD_MAP porque el llenador
// los resuelve aparte: ref1_cp/ref2_cp (el PDF trae el campo "P" duplicado
// con el mismo nombre para las 2 referencias, se escribe por posición) y
// fecha_solicitud (se reparte en los campos Dia/Mes/Año del PDF).
const HANDLED_SEPARATELY = new Set(["ref1_cp", "ref2_cp", "fecha_solicitud"]);

describe("SOLICITUD_CREDITO_SECTIONS <-> llenador del PDF: cobertura", () => {
  it("todo campo de texto/select de la pantalla tiene dónde escribirse en el PDF", () => {
    const allFields = SOLICITUD_CREDITO_SECTIONS.flatMap((s) => s.fields);
    const missing = allFields
      .filter((f) => f.type !== "select")
      .map((f) => f.key)
      .filter((key) => !HANDLED_SEPARATELY.has(key) && !(key in TEXT_FIELD_MAP));
    expect(missing).toEqual([]);
  });

  it("todo campo tipo select tiene su grupo de radio o está entre los documentados aparte", () => {
    // destino_credito/oferta_vinculante/etc. van por RADIO_FIELD_MAP; el resto de
    // selects (p.ej. regimen_patrimonial) tiene su propio mapa de checkboxes.
    const selectFields = SOLICITUD_CREDITO_SECTIONS.flatMap((s) => s.fields).filter((f) => f.type === "select");
    const unmapped = selectFields.map((f) => f.key).filter((key) => key !== "regimen_patrimonial" && !(key in RADIO_FIELD_MAP));
    expect(unmapped).toEqual([]);
  });

  it("cada grupo de radio tiene exactamente un valor de PDF por etiqueta, sin duplicados", () => {
    for (const [key, config] of Object.entries(RADIO_FIELD_MAP)) {
      const field = SOLICITUD_CREDITO_SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key);
      expect(field, `campo "${key}" no existe en SOLICITUD_CREDITO_SECTIONS`).toBeTruthy();
      const labels = Object.keys(config.values);
      expect(labels.sort()).toEqual([...field.options].sort());
      const pdfValues = Object.values(config.values);
      expect(new Set(pdfValues).size).toBe(pdfValues.length);
    }
  });
});

// Mapeo medido a mano sobre la plantilla oficial (ver coordenadas/orden de
// los widgets del AcroForm) y confirmado renderizando un PDF de prueba con
// cada opción — un cambio aquí sin volver a confirmar visualmente contra el
// PDF real es casi seguro un error de transcripción (ya pasó una vez con
// "Vendedor").
describe("RADIO_FIELD_MAP: valores exactos confirmados contra el PDF oficial", () => {
  it("Producto", () => {
    expect(RADIO_FIELD_MAP.producto.values).toEqual({
      Infonavit: "1",
      "Infonavit Total": "2",
      Cofinavit: "3",
      "Cofinavit Ingresos Adicionales": "4",
    });
  });

  it("Tipo de Crédito", () => {
    expect(RADIO_FIELD_MAP.tipo_credito.values).toEqual({
      Individual: "Opción1",
      Conyugal: "2",
      Corresidencial: "3",
      Familiar: "4",
    });
  });

  it("Destino de Crédito", () => {
    expect(RADIO_FIELD_MAP.destino_credito.values).toEqual({
      "Comprar una Vivienda": "destino 1",
      "Comprar Terreno": "2",
      "Comprar terreno y construir una vivienda": "3",
      "Construir Vivienda": "4",
      "Reparar, Ampliar o Mejorar la Vivienda": "5",
      "Compra y Mejora de Vivienda": "6",
      "Pagar el Pasivo o la Hipoteca de la Vivienda con garantía hipotecaria": "7",
      "Pagar el Pasivo o la Hipoteca de la Vivienda con garantía del Saldo de Subcuenta de Vivienda": "8",
    });
  });

  it("Vendedor (sección 8)", () => {
    expect(RADIO_FIELD_MAP.vendedor_tipo.values).toEqual({
      "Vendedor y/o apoderado del vendedor": "Opción3",
      "Agente inmobiliario": "Opción1",
      "Administradora designada para construcción": "Opción2",
      Derechohabiente: "Opción4",
      Emprendedor: "Opción5",
    });
  });

  it("P.V (contacto, sección 10)", () => {
    expect(RADIO_FIELD_MAP.contacto_tipo.values).toEqual({
      "Promotor de ventas": "Opción6",
      Emprendedor: "Opción1",
      "Agente inmobiliario": "Opción2",
    });
  });

  it("Género (derechohabiente y cónyuge/familiar)", () => {
    expect(RADIO_FIELD_MAP.genero.values).toEqual({ Masculino: "0", Femenino: "1" });
    expect(RADIO_FIELD_MAP.cfc_genero.values).toEqual({ Masculino: "genero c1", Femenino: "Opción2" });
  });

  it("régimen patrimonial: 3 checkboxes, uno por opción", () => {
    expect(REGIMEN_CHECKBOX_MAP).toEqual({
      "Separación de Bienes": "undefined.Casilla de verificación3",
      "Sociedad Conyugal": "Casilla de verificación1",
      "Sociedad Legal": "Casilla de verificación2",
    });
  });
});

const TEMPLATE_BYTES = readFileSync(new URL("../../public/solicitud_credito_infonavit.pdf", import.meta.url));

// Widgets de un campo con ese nombre, en el orden en que CELL_ROWS los espera.
async function widgetRectangles(doc) {
  const byName = {};
  for (const field of doc.getForm().getFields()) {
    for (const widget of field.acroField.getWidgets()) (byName[field.getName()] ??= []).push(widget.getRectangle());
  }
  return byName;
}

describe("CELL_ROWS: geometría de casillas medida sobre la plantilla", () => {
  it("cada renglón cae sobre el rectángulo de su widget en el PDF oficial", async () => {
    const rects = await widgetRectangles(await PDFDocument.load(TEMPLATE_BYTES));
    for (const [name, rows] of Object.entries(CELL_ROWS)) {
      expect(rows.length, `"${name}": renglones vs widgets`).toBe(rects[name]?.length);
      rows.forEach((row, i) => {
        const rect = rects[name][i];
        expect(Math.abs(row.x - rect.x), `"${name}" x`).toBeLessThan(8);
        expect(row.y, `"${name}" y`).toBeGreaterThan(rect.y - 3);
        expect(row.y, `"${name}" y`).toBeLessThan(rect.y + rect.height);
        expect(row.cells).toBeGreaterThanOrEqual(2);
        expect(row.pitch).toBeGreaterThan(9);
        expect(row.pitch).toBeLessThan(13);
      });
    }
  });

  it("todo campo de TEXT_FIELD_MAP (salvo Entidad financiera, que es un renglón corrido) tiene sus casillas", () => {
    const missing = Object.values(TEXT_FIELD_MAP).filter((pdfName) => pdfName !== "ENTIDAD FINANCIERA" && !CELL_ROWS[pdfName]);
    expect(missing).toEqual([]);
  });
});

describe("buildSolicitudCreditoPdf: llenado sobre las casillas", () => {
  afterEach(() => vi.unstubAllGlobals());

  async function build(record) {
    vi.stubGlobal("fetch", async () => ({ ok: true, arrayBuffer: async () => TEMPLATE_BYTES }));
    const doc = await PDFDocument.load(await buildSolicitudCreditoPdf(record));
    return doc.getForm();
  }

  it("escribe un carácter por casilla cuando el valor cabe", async () => {
    const form = await build({ viv_calle: "CALLE DE LOS PINOS", nss: "12345678901" });
    const calle = form.getTextField("Calle DV");
    expect(calle.getText()).toBe("CALLE DE LOS PINOS");
    expect(calle.isCombed()).toBe(true);
    expect(calle.getMaxLength()).toBe(CELL_ROWS["Calle DV"][0].cells);
    expect(form.getTextField("NSS").isCombed()).toBe(true);
  });

  it("no trunca: un monto de 7 dígitos en un renglón de 6 casillas se escribe completo, sin comb", async () => {
    const form = await build({ monto_credito_dh: "1250000" });
    const monto = form.getTextField("Monto Credito DH");
    expect(monto.getText()).toBe("1250000");
    expect(monto.isCombed()).toBe(false);
  });

  it("la lada (2 casillas impresas) admite 3 dígitos sin comb", async () => {
    const form = await build({ telefono_lada: "871", telefono_numero: "1234567" });
    expect(form.getTextField("Lada DI-DH").getText()).toBe("871");
    expect(form.getTextField("Lada DI-DH").isCombed()).toBe(false);
    expect(form.getTextField("Número DI-DH").getText()).toBe("1234567");
  });

  it("la CLABE del acreedor va en su renglón (Texto94), no en la razón social", async () => {
    const form = await build({ acreedor_clabe: "112345678901234567", acreedor_razon_social_cuenta: "BANCO EJEMPLO SA" });
    expect(form.getTextField("Texto94").getText()).toBe("112345678901234567");
    expect(form.getTextField("RFC Vend 2b").getText()).toBe("BANCO EJEMPLO SA");
    expect(form.getTextField("Razon Social  Vend2").getText() ?? "").toBe("");
  });

  it("reparte la fecha en día, mes y los dos últimos dígitos del año", async () => {
    const form = await build({ fecha_solicitud: "2026-10-20" });
    expect(form.getTextField("Dia").getText()).toBe("20");
    expect(form.getTextField("Mes").getText()).toBe("OCTUBRE");
    expect(form.getTextField("Año").getText()).toBe("26");
  });
});

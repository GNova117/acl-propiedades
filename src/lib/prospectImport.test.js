import { describe, expect, it } from "vitest";
import {
  IMPORT_SOURCE,
  MAX_IMPORT_ROWS,
  isImportable,
  markRepeats,
  normalizePhone,
  parseCsv,
  parseProspectInput,
  prospectFieldsFromRow,
  rowIssues,
} from "./prospectImport";

const names = (rows) => rows.map((r) => [r.name, r.phone, r.email]);

describe("normalizePhone", () => {
  it("deja 10 dígitos de cualquier forma común de escribirlo", () => {
    for (const raw of ["8711234567", "871 123 4567", "(871) 123-4567", "+52 871 123 4567", "52 871 123 4567", "+52 1 871 123 4567", "044 871 123 4567", "045-871-123-4567", "p:+528711234567", "871.123.4567"]) {
      expect(normalizePhone(raw), raw).toBe("8711234567");
    }
  });
  it("lo que no es un teléfono de 10 dígitos da null", () => {
    for (const raw of ["", null, undefined, "871 123", "87112345678", "+1 415 555 2671", "abc"]) expect(normalizePhone(raw), String(raw)).toBeNull();
  });
});

describe("parseProspectInput: texto pegado", () => {
  it("nombre y teléfono en la misma línea, en cualquier orden y con etiquetas", () => {
    const { kind, rows } = parseProspectInput(
      ["Luis Pérez 871 123 4567", "8712345678 Ana López", "Tel: 871-345-6789 - Carlos Ruiz", "Marta Díaz: +52 1 871 456 7890", "1. Jorge Soto (871) 567 8901"].join("\n")
    );
    expect(kind).toBe("text");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", ""],
      ["Ana López", "8712345678", ""],
      ["Carlos Ruiz", "8713456789", ""],
      ["Marta Díaz", "8714567890", ""],
      ["Jorge Soto", "8715678901", ""],
    ]);
  });

  it("nombre en un renglón y teléfono en el siguiente (contactos compartidos de WhatsApp)", () => {
    const { rows } = parseProspectInput("~ Luis Pérez\n+52 871 123 4567\n\nAna López\n871 234 5678");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", ""],
      ["Ana López", "8712345678", ""],
    ]);
  });

  it("un renglón de texto cualquiera no se pega al siguiente teléfono como nombre", () => {
    const { rows } = parseProspectInput("Hola buenas tardes, me interesa una casa de dos recámaras cerca del centro por favor\n871 123 4567");
    expect(names(rows)).toEqual([["", "8711234567", ""]]);
  });

  it("un teléfono pegado a otros números («Persona 3 871…») se encuentra igual", () => {
    expect(names(parseProspectInput("Persona 3 871 123 4567").rows)).toEqual([["Persona 3", "8711234567", ""]]);
  });

  it("quita la fecha y hora de un chat exportado", () => {
    const { rows } = parseProspectInput("[12/11/26 10:30:15] Luis Pérez: 871 123 4567\n12/11/2026, 10:31 - Ana López: 8712345678");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", ""],
      ["Ana López", "8712345678", ""],
    ]);
  });

  it("saca el correo, con o sin teléfono", () => {
    const { rows } = parseProspectInput("Luis Pérez luis@correo.com 8711234567\nAna López - ana.lopez@mail.mx");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", "luis@correo.com"],
      ["Ana López", "", "ana.lopez@mail.mx"],
    ]);
  });

  it("un teléfono sin 10 dígitos no se toma, pero el renglón con correo sí", () => {
    expect(parseProspectInput("Luis Pérez 871 123").rows).toEqual([]);
  });

  it("vacío o sin nada utilizable da cero renglones", () => {
    expect(parseProspectInput("").rows).toEqual([]);
    expect(parseProspectInput("hola\nbuen día").rows).toEqual([]);
  });
});

describe("parseProspectInput: CSV", () => {
  it("con encabezados en español, comillas y puntos y coma", () => {
    const csv = 'Nombre;Teléfono;Correo;Notas\n"Pérez, Luis";871 123 4567;luis@x.com;"Quiere casa\ncerca del centro"\nAna López;8712345678;;';
    const { kind, rows } = parseProspectInput(csv);
    expect(kind).toBe("csv");
    expect(rows[0]).toMatchObject({ name: "Pérez, Luis", phone: "8711234567", email: "luis@x.com", notes: "Quiere casa\ncerca del centro" });
    expect(rows[1]).toMatchObject({ name: "Ana López", phone: "8712345678", email: "" });
  });

  it("exportación de Facebook Lead Ads: full_name, phone_number con «p:», sin otras columnas útiles", () => {
    const csv = "id,created_time,ad_name,full_name,phone_number,email,city\n1,2026-11-10T10:00:00,Casa,Luis Pérez,p:+528711234567,luis@x.com,Torreón\n2,2026-11-10T11:00:00,Casa,Ana López,p:+528712345678,,Gómez";
    const { kind, rows } = parseProspectInput(csv);
    expect(kind).toBe("csv");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", "luis@x.com"],
      ["Ana López", "8712345678", ""],
    ]);
  });

  it("nombre y apellido en columnas separadas, y «Qué busca»", () => {
    const { rows } = parseProspectInput("First Name,Last Name,Celular,Qué busca\nLuis,Pérez,871 123 4567,Casa en Torreón");
    expect(rows[0]).toMatchObject({ name: "Luis Pérez", phone: "8711234567", looking_for: "Casa en Torreón" });
  });

  it("separado por tabuladores (pegado desde una hoja de cálculo)", () => {
    const { rows } = parseProspectInput("Nombre\tTeléfono\nLuis Pérez\t871 123 4567");
    expect(names(rows)).toEqual([["Luis Pérez", "8711234567", ""]]);
  });

  it("una sola columna con encabezado no deja que «phone_number» sea un nombre", () => {
    const { kind, rows } = parseProspectInput("phone_number\n8711234567\n8712345678");
    expect(kind).toBe("csv");
    expect(names(rows)).toEqual([
      ["", "8711234567", ""],
      ["", "8712345678", ""],
    ]);
  });

  it("una lista con comas pero sin encabezados se lee renglón por renglón", () => {
    const { kind, rows } = parseProspectInput("Luis Pérez, 871 123 4567\nAna López, 871 234 5678, ana@x.com");
    expect(kind).toBe("text");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", ""],
      ["Ana López", "8712345678", "ana@x.com"],
    ]);
  });

  it("parseCsv: comillas escapadas, saltos de línea dentro de una celda, BOM y renglones vacíos", () => {
    expect(parseCsv('﻿a,"b ""c""",d\r\n\r\n"x\ny",,z\r\n')).toEqual([
      ["a", 'b "c"', "d"],
      ["x\ny", "", "z"],
    ]);
  });
});

describe("parseProspectInput: tarjetas vCard", () => {
  it("nombre, teléfono y correo de cada contacto", () => {
    const vcf = [
      "BEGIN:VCARD", "VERSION:3.0", "FN:Luis Pérez", "TEL;type=CELL;waid=528711234567:+52 871 123 4567", "EMAIL:luis@x.com", "END:VCARD",
      "BEGIN:VCARD", "VERSION:3.0", "N:López;Ana;;;", "TEL;TYPE=CELL:8712345678", "END:VCARD",
      "BEGIN:VCARD", "FN:Sin Datos", "END:VCARD",
    ].join("\r\n");
    const { kind, rows } = parseProspectInput(vcf);
    expect(kind).toBe("vcard");
    expect(names(rows)).toEqual([
      ["Luis Pérez", "8711234567", "luis@x.com"],
      ["Ana López", "8712345678", ""],
    ]);
  });
});

describe("repetidos, límite y validación", () => {
  it("marca el renglón que repite el teléfono (aunque lo escribieran distinto) o el correo de uno anterior", () => {
    const { rows } = parseProspectInput("Luis 871 123 4567\nLuis P. +52 871 123 4567\nAna a@x.com\nAna López A@X.COM\nOtro 871 999 0000");
    expect(rows.map((r) => r.repeated)).toEqual([false, true, false, true, false]);
    expect(markRepeats([{ phone: "", email: "" }, { phone: "", email: "" }]).map((r) => r.repeated)).toEqual([false, false]);
  });

  it("toma a lo más MAX_IMPORT_ROWS y lo avisa", () => {
    const lines = Array.from({ length: MAX_IMPORT_ROWS + 5 }, (_, i) => `Persona ${i} 871${String(10000000 + i).slice(1)}`);
    const out = parseProspectInput(lines.join("\n"));
    expect(out.rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(out.truncated).toBe(true);
    expect(parseProspectInput("Luis 871 123 4567").truncated).toBe(false);
  });

  it("rowIssues: sin nombre, teléfono mal escrito, sin ningún medio de contacto", () => {
    expect(rowIssues({ name: "Luis", phone: "8711234567", email: "" })).toEqual([]);
    expect(rowIssues({ name: "Luis", phone: "", email: "a@x.com" })).toEqual([]);
    expect(rowIssues({ name: "", phone: "8711234567", email: "" })).toEqual(["noName"]);
    expect(rowIssues({ name: "Luis", phone: "871 123", email: "" })).toEqual(["badPhone", "noContact"]);
    expect(rowIssues({ name: "Luis", phone: "871 123", email: "a@x.com" })).toEqual(["badPhone"]);
    expect(rowIssues({ name: "Luis", phone: "", email: "" })).toEqual(["noContact"]);
    expect(isImportable({ name: "Luis", phone: "+52 871 123 4567", email: "" })).toBe(true);
    expect(isImportable({ name: " ", phone: "8711234567", email: "" })).toBe(false);
  });
});

describe("prospectFieldsFromRow", () => {
  it("arma los campos de un prospecto nuevo: teléfono normalizado, origen «importado», sin etapa avanzada", () => {
    const fields = prospectFieldsFromRow({ name: "  Luis Pérez ", phone: "+52 871 123 4567", email: " luis@x.com ", notes: "Quiere casa", looking_for: "" }, { advisorId: "advisor-1" });
    expect(fields).toEqual({
      name: "Luis Pérez",
      phone: "8711234567",
      email: "luis@x.com",
      source: IMPORT_SOURCE,
      stage: "nuevo",
      advisor_id: "advisor-1",
      property_id: null,
      looking_for: null,
      notes: "Quiere casa",
      last_contact_at: null,
      next_followup_at: null,
      lost_reason: null,
    });
  });
  it("sin asesor, sin teléfono ni correo: null", () => {
    expect(prospectFieldsFromRow({ name: "Ana", phone: "", email: "a@x.com" })).toMatchObject({ advisor_id: null, phone: null, email: "a@x.com" });
  });
});

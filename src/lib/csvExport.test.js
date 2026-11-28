import { describe, expect, it } from "vitest";
import { escapeCsvValue } from "./csvExport";

describe("escapeCsvValue", () => {
  it("deja intactos los textos normales y vacíos", () => {
    expect(escapeCsvValue("Ana Pérez")).toBe("Ana Pérez");
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("escapa comas, comillas y saltos de línea (RFC 4180)", () => {
    expect(escapeCsvValue('dijo "hola", y se fue')).toBe('"dijo ""hola"", y se fue"');
    expect(escapeCsvValue("a\nb")).toBe('"a\nb"');
  });

  it("neutraliza celdas de texto que Excel ejecutaría como fórmula", () => {
    expect(escapeCsvValue("=1+1")).toBe("'=1+1");
    expect(escapeCsvValue("+52 871 123 4567")).toBe("'+52 871 123 4567");
    expect(escapeCsvValue("-2+3")).toBe("'-2+3");
    expect(escapeCsvValue("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsvValue("\t=cmd")).toBe("'\t=cmd");
    expect(escapeCsvValue("\r=cmd")).toBe(`"'\r=cmd"`);
  });

  it("neutraliza la fórmula aunque además lleve comillas o comas", () => {
    expect(escapeCsvValue('=HYPERLINK("http://malo.com","clic")')).toBe(`"'=HYPERLINK(""http://malo.com"",""clic"")"`);
  });

  it("no toca los números, ni los negativos", () => {
    expect(escapeCsvValue(-5)).toBe("-5");
    expect(escapeCsvValue(1500000)).toBe("1500000");
    expect(escapeCsvValue(0)).toBe("0");
  });
});

import { describe, expect, it } from "vitest";
import { BRAND, brandedHtml, escapeHtml, renderEmail } from "./emailLayout.js";
import { buildVisitEmail } from "./visitEmail.js";
import { buildWeeklyReport, renderWeeklyEmail } from "../reporte-semanal/report.js";

const SHELL = ["ACL Propiedades</td>", `border-bottom:3px solid ${BRAND}`, "Torreón, Gómez Palacio y Lerdo", 'max-width:'];

describe("renderEmail", () => {
  it("arma encabezado de marca, título, saludo, botones y pie", () => {
    const html = renderEmail({
      preheader: "vista previa",
      heading: "Hola <mundo>",
      greeting: "Hola Ana,",
      lines: ["Un párrafo."],
      details: [["Fecha", "lunes"]],
      buttons: [{ href: "https://a.mx/x?y=1&z=2", label: "Abrir", primary: true }],
      footnote: "Nota al pie",
    });
    for (const piece of SHELL) expect(html).toContain(piece);
    expect(html).toContain("Hola &lt;mundo&gt;");
    expect(html).toContain("https://a.mx/x?y=1&amp;z=2");
    expect(html).toContain("Nota al pie");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  it("sin saludo, detalles ni botones no deja bloques vacíos", () => {
    const html = renderEmail({ heading: "Solo título" });
    expect(html).not.toContain('<div style="margin:0 0 8px">');
    expect(html).not.toContain("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:4px 0 18px\">");
  });

  it("escapa comillas y apóstrofos", () => {
    expect(escapeHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });
});

describe("brandedHtml", () => {
  it("mete un fragmento en la plantilla con el asunto como título", () => {
    const html = brandedHtml("Informe", "<p>Hola</p>");
    for (const piece of SHELL) expect(html).toContain(piece);
    expect(html).toContain("<h1");
    expect(html).toContain("<p>Hola</p>");
  });
  it("respeta un documento HTML completo", () => {
    const full = "<!DOCTYPE html><html><body>x</body></html>";
    expect(brandedHtml("A", full)).toBe(full);
  });
});

describe("todos los correos comparten la misma plantilla", () => {
  it("el de visitas", () => {
    const cita = {
      id: "c1", fecha: "2026-12-01", hora: "10:00", duracion_min: 30, booking_token: "tok", contact_name: "Ana Pérez", contact_email: "a@b.mx",
      property: { id: "p1", title: "Casa", code: "ACL-1", address: "Calle 1" }, advisor: { name: "Luis" },
    };
    const { html } = buildVisitEmail("confirmacion", cita);
    for (const piece of SHELL) expect(html).toContain(piece);
  });

  it("el resumen semanal", () => {
    const { html } = renderWeeklyEmail(buildWeeklyReport({}, "2026-10-26"));
    for (const piece of SHELL) expect(html).toContain(piece);
    expect(html).toContain("Resumen semanal");
  });
});

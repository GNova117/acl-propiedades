import { test, expect, isoDate } from "./fixtures.js";

// Alta → aparece en el listado → baja, para los formularios simples del panel.
// Rellena cada formulario con datos genéricos según el tipo de campo (texto,
// número, correo, teléfono, fecha, lista…), así que sirve de red de seguridad
// general: si alguien rompe un formulario o su listado, falla aquí.
//
// Quedan fuera, con su propia prueba o por diseño:
//  - Visitas e Inspecciones (reglas propias: fecha no futura, todos los criterios) → features.spec.js
//  - Propiedades (ciclo completo) → admin.spec.js
//  - Construcción: avisa que no está disponible en modo demo.

const FORMULARIOS = [
  { nombre: "Asesores", lista: "/admin/asesores", nuevo: "/admin/asesores/nuevo" },
  { nombre: "Clientes", lista: "/admin/clientes", nuevo: "/admin/clientes/nuevo" },
  { nombre: "Prospectos", lista: "/admin/prospectos", nuevo: "/admin/prospectos/nuevo" },
  { nombre: "Blog", lista: "/admin/blog", nuevo: "/admin/blog/nuevo" },
  { nombre: "Novedades", lista: "/admin/novedades", nuevo: "/admin/novedades/nueva" },
  { nombre: "Agenda", lista: "/admin/agenda", nuevo: "/admin/agenda/nueva" },
  { nombre: "Remodelaciones", lista: "/admin/remodelaciones", nuevo: "/admin/remodelaciones/nuevo" },
  { nombre: "Materiales", lista: "/admin/materiales", nuevo: "/admin/materiales/nuevo" },
  { nombre: "Plantillas de documentos", lista: "/admin/plantillas-documentos", nuevo: "/admin/plantillas-documentos/nueva" },
  { nombre: "Desarrollos", lista: "/admin/desarrollos", nuevo: "/admin/desarrollos/nuevo" },
  { nombre: "Naves industriales", lista: "/admin/naves-industriales", nuevo: "/admin/naves-industriales/nueva" },
];

// Llena todos los campos visibles y editables del formulario con un valor
// válido según su tipo. `marca` identifica el registro en el listado.
async function rellenar(form, marca) {
  const campos = form.locator("input, select, textarea");
  for (let i = 0; i < (await campos.count()); i++) {
    const campo = campos.nth(i);
    if (!(await campo.isVisible()) || !(await campo.isEnabled())) continue;
    const tag = await campo.evaluate((e) => e.tagName.toLowerCase());
    const tipo = (await campo.getAttribute("type")) || "";
    const id = (await campo.getAttribute("id")) || (await campo.getAttribute("name")) || "";
    if (["file", "checkbox", "radio", "hidden", "submit", "button", "range", "color"].includes(tipo)) continue;
    if (/empresa/i.test(id) || (await campo.getAttribute("tabindex")) === "-1") continue; // campo trampa anti-spam

    if (tag === "select") {
      const valores = await campo.locator("option").evaluateAll((os) => os.map((o) => o.value));
      const indice = valores.findIndex((v) => v !== "");
      if (indice >= 0) await campo.selectOption({ index: indice });
    } else if (tag === "textarea") await campo.fill(`${marca} texto de prueba`);
    else if (tipo === "number") await campo.fill(/lat/i.test(id) ? "25.54" : /lng|lon/i.test(id) ? "-103.41" : "5");
    else if (tipo === "email") await campo.fill(`${marca.toLowerCase()}@example.com`);
    else if (tipo === "tel") await campo.fill("8711234567");
    else if (tipo === "date") await campo.fill(isoDate(30));
    else if (tipo === "time") await campo.fill("10:30");
    else if (tipo === "datetime-local") await campo.fill(`${isoDate(30)}T10:30`);
    else if (tipo === "url") await campo.fill("https://example.com/qa");
    else await campo.fill(`${marca} ${id}`.slice(0, 40));
  }
}

test.describe("Alta, listado y baja de formularios del panel", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  for (const { nombre, lista, nuevo } of FORMULARIOS) {
    test(nombre, async ({ page, go, press }) => {
      test.setTimeout(60_000);
      const marca = `QAAUTO${Date.now() % 100000}`;

      await go(nuevo);
      const form = page.locator("main form").first();
      await expect(form).toBeVisible();
      const guardar = form.locator("button[type=submit]").last();

      // Vacío: debe avisar qué falta, no guardar en silencio.
      await guardar.scrollIntoViewIfNeeded();
      await press(guardar);
      await expect(page.locator(".form-error").first()).toBeVisible();

      await rellenar(form, marca);
      await guardar.scrollIntoViewIfNeeded();
      await press(guardar);
      await expect(page.locator(".form-error"), "el formulario no guardó").toHaveCount(0);
      await page.waitForURL((u) => u.pathname !== nuevo);

      await go(lista);
      const principal = page.locator("main");
      await expect(principal).toContainText(new RegExp(marca, "i"));

      // El botón de eliminar del registro: en su fila de tabla, su elemento de lista o su tarjeta.
      let borrar = null;
      for (const selector of ["tr", "li", ".card"]) {
        const candidato = page.locator(selector, { hasText: marca }).last().locator("button.btn-danger, button:has-text('Eliminar'), button:has-text('Borrar')").first();
        if (await candidato.count()) {
          borrar = candidato;
          break;
        }
      }
      expect(borrar, "el registro no tiene botón de eliminar").not.toBeNull();
      await borrar.scrollIntoViewIfNeeded();
      await press(borrar);
      await expect(principal).not.toContainText(marca);
    });
  }
});

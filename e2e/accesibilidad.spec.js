import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "./fixtures.js";

// Revisión automática de accesibilidad (axe-core, reglas WCAG 2 A y AA) de las pantallas principales, en modo claro y
// oscuro, en PC y teléfono. Falla ante CUALQUIER violación «serious» o «critical» que no esté en EXCEPCIONES. Cada
// excepción lleva su motivo: es una deuda conocida, no algo que se ignora; al corregirla se quita de la lista (y si la
// regla ya no falla, la prueba lo avisa para que no se quede una excepción de más). Ver también src/lib/contrast.test.js,
// que revisa el contraste de las variables de color sin abrir el navegador.

const PUBLICAS = [
  "/", "/propiedades", "/propiedades?vista=mapa", "/propiedades/prop-1", "/propiedades/zona/torreon", "/desarrollos", "/desarrollos/torre-aurora", "/testimonios",
  "/calculadora", "/vende-tu-casa", "/comparar-creditos", "/simulador-credito", "/guia-del-comprador", "/blog", "/contacto", "/nosotros", "/favoritos", "/comparar",
  "/aviso-de-privacidad", "/ruta-que-no-existe",
];
const PANEL = [
  "/admin", "/admin/mi-dia", "/admin/propiedades", "/admin/propiedades/nueva", "/admin/desarrollos", "/admin/zonas", "/admin/asesores", "/admin/clientes",
  "/admin/clientes/nuevo", "/admin/prospectos", "/admin/prospectos/nuevo", "/admin/equipo", "/admin/estadisticas", "/admin/alertas", "/admin/mensajes",
  "/admin/testimonios", "/admin/blog", "/admin/visitas", "/admin/gastos", "/admin/valuacion", "/admin/solicitud-avaluo", "/admin/inspecciones",
  "/admin/credito-infonavit", "/admin/solicitud-credito", "/admin/documentos-legales", "/admin/plantillas-documentos", "/admin/firmas", "/admin/remodelaciones",
  "/admin/materiales", "/admin/agenda", "/admin/agenda/nueva", "/admin/secretaria", "/admin/reportes", "/admin/reporte-mensual", "/admin/comisiones",
  "/admin/actividad", "/admin/errores", "/admin/respaldo", "/admin/arco", "/admin/novedades", "/admin/roles", "/admin/ayuda", "/admin/seguridad",
];

// ruta → { regla: motivo }. Vacío = la pantalla pasa limpia.
const EXCEPCIONES = {};

async function revisar(page, ruta) {
  const resultado = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = resultado.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const permitidas = EXCEPCIONES[ruta] || {};
  const nuevas = graves.filter((v) => !(v.id in permitidas));
  const resumen = nuevas.map((v) => `${v.id} (${v.impact}): ${v.help}\n   ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n   ")}`);
  expect(resumen, `Violaciones de accesibilidad en ${ruta}`).toEqual([]);
  // Una excepción que ya no hace falta se quita (así la lista no se llena de deuda que ya se pagó).
  const sobran = Object.keys(permitidas).filter((id) => !graves.some((v) => v.id === id));
  expect(sobran, `Excepciones que ya no hacen falta en ${ruta}`).toEqual([]);
}

for (const tema of ["light", "dark"]) {
  test.describe(`Accesibilidad (axe) · modo ${tema === "light" ? "claro" : "oscuro"}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => {
        // (en un iframe de otro origen —el mapa de Contacto— no hay localStorage: no es un error)
        try {
          localStorage.setItem("acl_theme", t);
        } catch {
          /* sin almacenamiento */
        }
      }, tema);
    });

    for (const ruta of PUBLICAS) {
      test(`sitio público ${ruta}`, async ({ page, go }) => {
        await go(ruta);
        await expect(page.locator("main, #main-content").first()).toBeVisible();
        await revisar(page, ruta);
      });
    }

    for (const ruta of PANEL) {
      test(`panel ${ruta}`, async ({ page, go, seedAdminSession }) => {
        await seedAdminSession();
        await go(ruta);
        await expect(page.locator(".admin-layout__content")).toBeVisible();
        await revisar(page, ruta);
      });
    }

    test("inicio de sesión del panel", async ({ page, go }) => {
      await go("/admin/login");
      await expect(page.locator("#admin-email")).toBeVisible();
      await revisar(page, "/admin/login");
    });
  });
}

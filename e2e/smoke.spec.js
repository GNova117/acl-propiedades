import { test, expectHealthyPage } from "./fixtures.js";

// Cada ruta de la app, una por una: carga sin errores de página/consola, sin el
// aviso de error, con contenido, sin desbordarse de lado y sin <img src="">.
// Corre en PC y en móvil. Las rutas con token falso o inexistentes también
// deben cargar «con gracia» (mensaje de enlace inválido / 404), nunca en blanco.

const PUBLIC_ROUTES = [
  "/",
  "/propiedades",
  "/propiedades/prop-1",
  "/propiedades/zona/torreon",
  "/desarrollos/torre-aurora",
  "/naves-industriales",
  "/terrenos",
  "/calculadora",
  "/vende-tu-casa",
  "/comparar-creditos",
  "/guia-del-comprador",
  "/nosotros",
  "/contacto",
  "/favoritos",
  "/comparar",
  "/aviso-de-privacidad",
  "/carta-de-derechos",
  "/blog",
  "/blog/no-existe",
  "/alertas/baja/token-falso",
  "/informe/token-falso",
  "/firmar/token-falso",
  "/documentos/token-falso",
  "/ruta-que-no-existe",
  "/propiedades/no-existe",
];

const ADMIN_ROUTES = [
  "/admin",
  "/admin/propiedades",
  "/admin/propiedades/nueva",
  "/admin/propiedades/prop-1",
  "/admin/propiedades/prop-1/bitacora",
  "/admin/propiedades/prop-1/liquidacion",
  "/admin/propiedades/prop-1/historial",
  "/admin/desarrollos",
  "/admin/desarrollos/nuevo",
  "/admin/naves-industriales",
  "/admin/naves-industriales/nueva",
  "/admin/asesores",
  "/admin/asesores/nuevo",
  "/admin/asesores/advisor-1",
  "/admin/mi-perfil",
  "/admin/mi-dia",
  "/admin/zonas",
  "/admin/clientes",
  "/admin/clientes/nuevo",
  "/admin/remodelaciones",
  "/admin/remodelaciones/nuevo",
  "/admin/materiales",
  "/admin/materiales/nuevo",
  "/admin/construccion",
  "/admin/construccion/nuevo",
  "/admin/credito-infonavit",
  "/admin/valuacion",
  "/admin/solicitud-avaluo",
  "/admin/solicitud-credito",
  "/admin/inspecciones",
  "/admin/inspecciones/nueva",
  "/admin/firmas",
  "/admin/documentos-legales",
  "/admin/plantillas-documentos",
  "/admin/plantillas-documentos/nueva",
  "/admin/actividad",
  "/admin/novedades",
  "/admin/novedades/nueva",
  "/admin/roles",
  "/admin/agenda",
  "/admin/agenda/nueva",
  "/admin/mensajes",
  "/admin/testimonios",
  "/admin/reporte-mensual",
  "/admin/reportes",
  "/admin/secretaria",
  "/admin/estadisticas",
  "/admin/alertas",
  "/admin/blog",
  "/admin/blog/nuevo",
  "/admin/prospectos",
  "/admin/prospectos/nuevo",
  "/admin/gastos",
  "/admin/gastos/historial",
  "/admin/visitas",
  "/admin/visitas/informes",
  "/admin/visitas/nueva",
  "/admin/visitas/propiedad/prop-1",
];

test.describe("Sitio público: cada ruta carga sana", () => {
  for (const route of PUBLIC_ROUTES) {
    test(route, async ({ page, go }) => {
      await go(route);
      await expectHealthyPage(page);
    });
  }
});

test.describe("Panel admin: cada ruta carga sana", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  for (const route of ADMIN_ROUTES) {
    test(route, async ({ page, go }) => {
      await go(route);
      await expectHealthyPage(page);
    });
  }
});

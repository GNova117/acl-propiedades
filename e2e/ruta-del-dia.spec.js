import { test, expect, expectHealthyPage } from "./fixtures.js";

// Ruta del día (Mi día): las citas que faltan hoy, en orden de hora, con el enlace que abre la ruta completa en Google Maps, el
// tramo entre una y otra y un aviso cuando no alcanza el tiempo. En pantalla ancha, además, el mapa con las paradas numeradas.
// El reloj se fija a las 8:00 para que «las que faltan» no dependa de la hora a la que corre la prueba.

const poner = (page, clave, valor) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [clave, valor]);
const hoy = () => new Date().toLocaleDateString("en-CA");
const ahora = () => new Date().toISOString();

const propiedad = (id, title, address, lat, lng) => ({
  id,
  code: id.toUpperCase(),
  title,
  type: "casa",
  description: "Casa de prueba",
  price: 1500000,
  area_m2: 120,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  zone: "Torreón",
  address,
  lat,
  lng,
  status: "disponible",
  operation_type: "compra",
  active: true,
  main_image: "",
  images: [],
  advisor_ids: ["advisor-1"],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const cita = (id, titulo, hora, extra = {}) => ({
  id,
  advisor_id: "advisor-1",
  client_id: null,
  property_id: null,
  titulo,
  fecha: hoy(),
  hora,
  duracion_min: 60,
  actividades: null,
  lugar: null,
  contact_name: "Cliente QA",
  contact_phone: "8715550199",
  contact_email: null,
  status: "confirmada",
  source: "admin",
  booking_token: id.padEnd(32, "0").slice(0, 32),
  created_at: ahora(),
  updated_at: ahora(),
  ...extra,
});

// Dos casas a ~4 km una de otra (≈ 10 min en auto).
const CASA_A = propiedad("prop-a", "Casa Morelos QA", "Calle Morelos 100, Torreón", 25.5428, -103.4068);
const CASA_B = propiedad("prop-b", "Casa Revolución QA", "Blvd. Revolución 500, Torreón", 25.5428, -103.3668);

test.describe("Ruta del día", () => {
  test.beforeEach(async ({ page, seedAdminSession }) => {
    await seedAdminSession();
    const ocho = new Date();
    ocho.setHours(8, 0, 0, 0);
    await page.clock.setFixedTime(ocho);
  });

  test("lista las paradas en orden, avisa cuando no alcanza el tiempo y abre la ruta completa en Maps", async ({ page, go, isMobile }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [CASA_A, CASA_B]);
    await poner(page, "acl_local_agenda_citas", [
      cita("c-1", "Visita Morelos QA", "10:00", { property_id: "prop-a" }),
      cita("c-2", "Visita Revolución QA", "11:05", { property_id: "prop-b" }), // 5 min de hueco para ≈10 de camino
      cita("c-3", "Cafe Galerías QA", "13:00", { lugar: "Café Plaza Galerías" }),
      cita("c-4", "Sin lugar QA", "15:00"),
    ]);
    await go("/admin/mi-dia");

    const ruta = page.locator("section.day-route");
    await expect(ruta).toBeVisible();
    await expect(ruta.getByRole("heading", { name: /Ruta de hoy/ })).toBeVisible();
    await expect(ruta.locator(".day-route__bar")).toContainText("3 paradas");
    await expect(ruta.locator(".day-route__bar")).toContainText(/≈ \d+(\.\d)? km en total/);

    const paradas = ruta.locator(".day-route__stop");
    await expect(paradas).toHaveCount(3);
    await expect(paradas.nth(0)).toContainText("10:00");
    await expect(paradas.nth(0)).toContainText("Visita Morelos QA");
    await expect(paradas.nth(0)).toContainText("Calle Morelos 100, Torreón");
    await expect(paradas.nth(1)).toContainText("Visita Revolución QA");
    await expect(paradas.nth(2)).toContainText("Café Plaza Galerías");

    // 10:00–11:00 y la siguiente a las 11:05: no alcanza.
    await expect(paradas.nth(1).locator(".day-route__leg--late")).toContainText("No alcanzas: hay 5 min");
    // Entre una casa y un lugar escrito a mano no hay ubicación exacta: sin tramo estimado.
    await expect(paradas.nth(2).locator(".day-route__leg")).toHaveCount(0);

    await expect(ruta.getByText(/1 cita sin lugar no entra en la ruta: Sin lugar QA/)).toBeVisible();

    const enlace = ruta.getByRole("link", { name: "Abrir ruta en Maps" });
    const url = new URL(await enlace.getAttribute("href"));
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("destination")).toBe("Café Plaza Galerías");
    expect(url.searchParams.get("waypoints")).toBe("25.5428,-103.4068|25.5428,-103.3668");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    expect(url.searchParams.has("origin")).toBe(false);

    // El mapa solo se arma en pantalla ancha.
    if (isMobile) await expect(ruta.locator(".day-route__map")).toHaveCount(0);
    else await expect(ruta.locator(".day-route__map .leaflet-marker-icon")).toHaveCount(2);
    await expectHealthyPage(page);
  });

  test("con una sola cita, o sin ninguna con lugar, no hay ruta que mostrar", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [CASA_A]);
    await poner(page, "acl_local_agenda_citas", [cita("c-1", "Visita Morelos QA", "10:00", { property_id: "prop-a" }), cita("c-2", "Sin lugar QA", "12:00")]);
    await go("/admin/mi-dia");
    await expect(page.locator(".my-day__item", { hasText: "Visita Morelos QA" })).toBeVisible();
    await expect(page.locator("section.day-route")).toHaveCount(0);
  });

  test("las citas que ya terminaron no entran en la ruta", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await poner(page, "acl_local_properties", [CASA_A, CASA_B]);
    await poner(page, "acl_local_agenda_citas", [
      cita("c-1", "Ya realizada QA", "08:00", { property_id: "prop-a", status: "realizada" }),
      cita("c-2", "Visita Morelos QA", "10:00", { property_id: "prop-a" }),
      cita("c-3", "Visita Revolución QA", "12:00", { property_id: "prop-b" }),
    ]);
    await go("/admin/mi-dia");
    const paradas = page.locator("section.day-route .day-route__stop");
    await expect(paradas).toHaveCount(2);
    await expect(paradas.first()).toContainText("Visita Morelos QA");
    await expect(page.locator("section.day-route").getByText("Ya realizada QA")).toHaveCount(0);
  });
});

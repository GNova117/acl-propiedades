import { test, expect, abrirMas } from "./fixtures.js";

// Dos mejoras para que el asesor trabaje más rápido:
//  - Carga entre pantallas: lo ya cargado se reutiliza (caché en memoria, «mostrar lo último y refrescar
//    por detrás»), pero al volver a una pantalla siempre se actualiza con lo que haya cambiado.
//  - Mi día: título y fecha en un renglón, sin los enlaces que ya están en la barra de abajo, y la
//    primera cita a la vista sin deslizar en el teléfono.

const ahora = () => new Date().toISOString();
const hoyLocal = () => new Date().toLocaleDateString("en-CA");
const horaEn = (minutos) => {
  const d = new Date(Date.now() + minutos * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const prospecto = (id, name, extra = {}) => ({
  id,
  name,
  phone: "8715550101",
  email: null,
  source: "manual",
  stage: "nuevo",
  advisor_id: "advisor-1",
  property_id: null,
  looking_for: null,
  notes: null,
  last_contact_at: null,
  next_followup_at: null,
  lost_reason: null,
  created_at: ahora(),
  updated_at: ahora(),
  ...extra,
});

const cita = (id, titulo, minutos) => ({
  id,
  advisor_id: "advisor-1",
  client_id: null,
  titulo,
  fecha: hoyLocal(),
  hora: horaEn(minutos),
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
});

// Navegar dentro de la app (sin recargar la página): es lo que hace la barra de abajo o el menú,
// y lo que aprovecha el caché. Es el mismo evento que dispara el botón «atrás» del navegador.
const irEnLaApp = (page, ruta) =>
  page.evaluate((r) => {
    window.history.pushState({}, "", r);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, ruta);

const leer = (page, clave) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]"), clave);

test.describe("Carga entre pantallas (caché que se refresca)", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("al volver a Prospectos se ve lo que cambió mientras tanto (el caché no deja datos viejos)", async ({ page, go }) => {
    await go("/admin/prospectos");
    await page.evaluate((rows) => localStorage.setItem("acl_local_prospectos", JSON.stringify(rows)), [prospecto("c1", "Primero Caché QA")]);
    await go("/admin/prospectos");
    await expect(page.locator(".prospect-card", { hasText: "Primero Caché QA" })).toBeVisible();

    await test.step("se sale a otra pantalla (sin recargar) y alguien más agrega un prospecto", async () => {
      await irEnLaApp(page, "/admin/mi-dia");
      await expect(page.locator(".admin-layout__content h1").first()).toHaveText("Mi día");
      const filas = await leer(page, "acl_local_prospectos");
      await page.evaluate((rows) => localStorage.setItem("acl_local_prospectos", JSON.stringify(rows)), [...filas, prospecto("c2", "Segundo Caché QA")]);
    });

    await test.step("al volver están los dos: el primero de inmediato y el nuevo al refrescar", async () => {
      await irEnLaApp(page, "/admin/prospectos");
      await expect(page.locator(".prospect-card", { hasText: "Primero Caché QA" })).toBeVisible();
      await expect(page.locator(".prospect-card", { hasText: "Segundo Caché QA" })).toBeVisible();
    });
  });

  test("un prospecto capturado con el «+» aparece en Prospectos sin recargar", async ({ page, go, press }) => {
    const nombre = `Capturado Caché ${Date.now() % 100000}`;
    await go("/admin/prospectos");
    await irEnLaApp(page, "/admin/mi-dia"); // ya se vio Prospectos: su lista está en el caché
    await press(page.getByRole("button", { name: "Acciones rápidas" }));
    await press(page.getByRole("menuitem", { name: "Prospecto rápido" }));
    const panel = page.locator(".quick-capture__sheet");
    await panel.locator("#qc-name").fill(nombre);
    await panel.locator("#qc-phone").fill("8715550303");
    await press(panel.locator("button[type=submit]"));
    await expect(page.locator(".quick-capture__done")).toBeVisible();
    await irEnLaApp(page, "/admin/prospectos");
    await expect(page.locator(".prospect-card", { hasText: nombre })).toBeVisible();
  });

  test("una cita nueva se ve en Mi día al volver, sin perder la que ya estaba", async ({ page, go }) => {
    await go("/admin/mi-dia");
    await page.evaluate((rows) => localStorage.setItem("acl_local_agenda_citas", JSON.stringify(rows)), [cita("cita-uno", "Primera Cita Caché QA", 60)]);
    await go("/admin/mi-dia");
    await expect(page.locator(".my-day__item", { hasText: "Primera Cita Caché QA" })).toBeVisible();

    await irEnLaApp(page, "/admin/agenda");
    const citas = await leer(page, "acl_local_agenda_citas");
    await page.evaluate((rows) => localStorage.setItem("acl_local_agenda_citas", JSON.stringify(rows)), [...citas, cita("cita-dos", "Segunda Cita Caché QA", 120)]);
    await irEnLaApp(page, "/admin/mi-dia");
    await expect(page.locator(".my-day__item", { hasText: "Primera Cita Caché QA" })).toBeVisible();
    await expect(page.locator(".my-day__item", { hasText: "Segunda Cita Caché QA" })).toBeVisible();
  });

  test("un cliente borrado en Clientes ya no aparece al volver (borrar actualiza la lista y el caché)", async ({ page, go, press }) => {
    const cliente = (id, name) => ({ id, name, type: "comprador", email: null, phone: "871 555 0100", notes: null, active: true, financiamiento: null, created_at: ahora(), updated_at: ahora() });
    await go("/admin/clientes");
    await page.evaluate((rows) => localStorage.setItem("acl_local_clients", JSON.stringify(rows)), [cliente("k1", "Se Queda QA"), cliente("k2", "Se Borra QA")]);
    await go("/admin/clientes");
    const fila = (n) => page.locator(".admin-table tbody tr.admin-row", { hasText: n });
    await expect(fila("Se Borra QA")).toBeVisible();

    const borrar = fila("Se Borra QA");
    await press(borrar.locator("details.row-more summary"));
    await press(borrar.getByRole("button", { name: "Eliminar" }));
    await expect(fila("Se Borra QA")).toHaveCount(0);

    await irEnLaApp(page, "/admin/mi-dia");
    await irEnLaApp(page, "/admin/clientes");
    await expect(fila("Se Queda QA")).toBeVisible();
    await expect(fila("Se Borra QA")).toHaveCount(0);
  });
});

test.describe("Mi día: encabezado compacto y la primera cita a la vista", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("título y fecha en un renglón; los enlaces a Agenda y Prospectos solo en pantalla ancha; la casilla de inicio al final", async ({ page, go, isMobile }) => {
    await go("/admin/mi-dia");
    await page.evaluate((rows) => localStorage.setItem("acl_local_agenda_citas", JSON.stringify(rows)), [cita("pronta", "Visita Próxima QA", 40), cita("luego", "Visita Luego QA", 200)]);
    await go("/admin/mi-dia");
    const primera = page.locator(".my-day__item", { hasText: "Visita Próxima QA" });
    await expect(primera).toBeVisible();

    await test.step("título y fecha comparten renglón", async () => {
      const titulo = await page.locator(".my-day h1").boundingBox();
      const fecha = await page.locator(".my-day__date").boundingBox();
      expect(Math.abs(titulo.y + titulo.height - (fecha.y + fecha.height)), "título y fecha en el mismo renglón").toBeLessThan(14);
    });

    await test.step("los enlaces: solo en pantalla ancha (en el teléfono ya están en la barra de abajo)", async () => {
      const enlaces = page.locator(".my-day__links");
      if (isMobile) {
        await expect(enlaces).toBeHidden();
        await expect(page.locator(".admin-tabbar")).toContainText("Agenda");
      } else {
        await expect(enlaces.getByRole("link", { name: "Agenda completa" })).toBeVisible();
        await expect(enlaces.getByRole("link", { name: "Todos los prospectos" })).toBeVisible();
      }
    });

    await test.step("la casilla de «abrir en Mi día» va después de las listas, no en el encabezado", async () => {
      const casilla = await page.locator(".my-day__home-toggle").boundingBox();
      const ultimaCita = await page.locator(".my-day__item").last().boundingBox();
      expect(casilla.y, "la casilla queda debajo de las listas").toBeGreaterThan(ultimaCita.y);
    });

    await test.step("en el teléfono la primera cita se ve entera sin deslizar", async () => {
      if (!isMobile) return;
      const caja = await primera.boundingBox();
      const barra = await page.locator(".admin-tabbar").boundingBox();
      expect(caja.y, "la cita empieza en la primera pantalla").toBeGreaterThan(0);
      expect(caja.y + caja.height, "y termina antes de la barra de abajo").toBeLessThanOrEqual(barra.y);
    });
  });
});

// ── Registro de contacto y agenda en pocos toques ──
const enDias = (dias) => new Date(Date.now() + dias * 864e5).toLocaleDateString("en-CA");

async function sembrar(page, go, rows, ruta) {
  await go("/admin/prospectos");
  await page.evaluate((r) => localStorage.setItem("acl_local_prospectos", JSON.stringify(r)), rows);
  await go(ruta);
}

test.describe("Resultado de un toque al registrar un contacto", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("«No contestó»: registra la llamada y deja el seguimiento para mañana, sin llenar nada más", async ({ page, go, press }) => {
    const p = prospecto("o1", "Sin Respuesta QA");
    await sembrar(page, go, [p], "/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: p.name });
    await abrirMas(tarjeta, press);
    await press(tarjeta.getByRole("button", { name: "Registrar contacto" }));
    const formulario = tarjeta.locator("form.contact-form");
    await expect(formulario.getByText("Resultado rápido")).toBeVisible();

    await press(formulario.getByRole("button", { name: "No contestó" }));
    await expect(formulario).toHaveCount(0);

    const [guardado] = await leer(page, "acl_local_prospectos");
    expect(guardado).toMatchObject({ stage: "contactado", next_followup_at: enDias(1) });
    expect(guardado.last_contact_at).toBeTruthy();
    const contactos = await leer(page, "acl_local_prospect_contacts");
    expect(contactos).toHaveLength(1);
    expect(contactos[0]).toMatchObject({ prospecto_id: "o1", channel: "llamada", note: "No contestó" });
  });

  test("«Interesado» (desde la ficha): seguimiento en 3 días y avanza a «interesado»; no hace retroceder a quien está más adelante", async ({ page, go, press }) => {
    const filas = [prospecto("o2", "Interesa QA", { stage: "contactado", last_contact_at: ahora() }), prospecto("o3", "Negocia QA", { stage: "negociacion", last_contact_at: ahora() })];
    await sembrar(page, go, filas, "/admin/prospectos/o2");
    const ficha = page.locator(".prospect-profile");
    await press(ficha.getByRole("button", { name: "Registrar contacto" }));
    await press(ficha.locator("form.contact-form").getByRole("button", { name: "Interesado", exact: true }));
    await expect(ficha.locator("form.contact-form")).toHaveCount(0);
    await expect(ficha.locator("select[aria-label='Etapa']")).toHaveValue("interesado");
    await expect(page.locator(".prospect-timeline__item[data-kind=contact]")).toHaveCount(1);
    let guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.find((x) => x.id === "o2")).toMatchObject({ stage: "interesado", next_followup_at: enDias(3) });

    await go("/admin/prospectos/o3");
    await press(page.locator(".prospect-profile").getByRole("button", { name: "Registrar contacto" }));
    await press(page.locator(".prospect-profile form.contact-form").getByRole("button", { name: "Interesado", exact: true }));
    await expect(page.locator(".prospect-timeline__item[data-kind=contact]")).toHaveCount(1);
    guardados = await leer(page, "acl_local_prospectos");
    expect(guardados.find((x) => x.id === "o3")).toMatchObject({ stage: "negociacion", next_followup_at: enDias(3) });
  });

  test("en un prospecto cerrado no hay resultados rápidos (no tiene seguimiento)", async ({ page, go, press }) => {
    const p = prospecto("o4", "Cerrado QA", { stage: "cerrado", last_contact_at: ahora() });
    await sembrar(page, go, [p], "/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: p.name });
    await abrirMas(tarjeta, press);
    await press(tarjeta.getByRole("button", { name: "Registrar contacto" }));
    await expect(tarjeta.locator("form.contact-form")).toBeVisible();
    await expect(tarjeta.getByText("Resultado rápido")).toHaveCount(0);
  });
});

test.describe("Agendar: fecha y hora rápidas", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("«Mañana», un sábado y las horas más comunes llenan la fecha y la hora con un toque", async ({ page, go, press }) => {
    await go("/admin/agenda/nueva");
    const atajos = page.getByRole("group", { name: "Fecha y hora rápidas" });
    await expect(atajos).toBeVisible();

    await press(atajos.getByRole("button", { name: "Mañana" }));
    await expect(page.locator("#cita-fecha")).toHaveValue(enDias(1));
    await expect(atajos.getByRole("button", { name: "Mañana" })).toHaveAttribute("aria-pressed", "true");
    await expect(atajos.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "false");

    await press(atajos.getByRole("button", { name: "Hoy" }));
    await expect(page.locator("#cita-fecha")).toHaveValue(enDias(0));

    // El tercer atajo es el próximo sábado.
    const sabado = atajos.locator(".quick-chip").nth(2);
    await press(sabado);
    const valor = await page.inputValue("#cita-fecha");
    expect(new Date(`${valor}T00:00:00`).getDay(), "el tercer atajo cae en sábado").toBe(6);

    await press(atajos.getByRole("button", { name: "10:00" }));
    await expect(page.locator("#cita-hora")).toHaveValue("10:00");
    await press(atajos.getByRole("button", { name: "16:00" }));
    await expect(page.locator("#cita-hora")).toHaveValue("16:00");
    await expect(atajos.getByRole("button", { name: "10:00" })).toHaveAttribute("aria-pressed", "false");
  });

  test("desde un prospecto: «Agendar» → «Mañana» → «12:00» → Guardar son cuatro toques y la cita queda completa", async ({ page, go, press }) => {
    test.setTimeout(60_000);
    const p = prospecto("a1", "Dos Toques QA", { property_id: "prop-1" });
    await sembrar(page, go, [p], "/admin/prospectos");
    const tarjeta = page.locator(".prospect-card", { hasText: p.name });
    await abrirMas(tarjeta, press);
    await press(tarjeta.getByRole("link", { name: "Agendar", exact: true }));
    await page.waitForURL("**/admin/agenda/nueva");
    await press(page.getByRole("button", { name: "Mañana" }));
    await press(page.getByRole("button", { name: "12:00" }));
    await press(page.locator("form button[type=submit]"));
    await page.waitForURL(/\/admin\/agenda\/(?!nueva)[^/]+$/);
    const [guardada] = await leer(page, "acl_local_agenda_citas");
    expect(guardada).toMatchObject({ prospecto_id: "a1", property_id: "prop-1", fecha: enDias(1), hora: "12:00" });
  });
});

test.describe("Refrescar al volver a la app", () => {
  test.beforeEach(async ({ seedAdminSession }) => {
    await seedAdminSession();
  });

  test("al volver a la app, un prospecto nuevo del sitio aparece sin cambiar de pantalla; si se acaba de cargar, no se repite la consulta", async ({ page, go }) => {
    await go("/admin/prospectos");
    await page.evaluate((rows) => localStorage.setItem("acl_local_prospectos", JSON.stringify(rows)), [prospecto("f1", "Ya Estaba QA")]);
    await go("/admin/prospectos");
    await expect(page.locator(".prospect-card", { hasText: "Ya Estaba QA" })).toBeVisible();

    const alVolver = () => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    const filas = await leer(page, "acl_local_prospectos");
    await page.evaluate((rows) => localStorage.setItem("acl_local_prospectos", JSON.stringify(rows)), [...filas, prospecto("f2", "Llegó Del Sitio QA", { source: "sitio" })]);

    await test.step("recién cargado (menos de 20 s): volver a la app no vuelve a pedir la lista", async () => {
      await alVolver();
      await page.waitForTimeout(400);
      await expect(page.locator(".prospect-card", { hasText: "Llegó Del Sitio QA" })).toHaveCount(0);
    });

    await test.step("pasados 20 s, al volver aparece solo", async () => {
      await page.clock.install();
      await page.clock.fastForward(30_000);
      await page.clock.resume();
      await alVolver();
      await expect(page.locator(".prospect-card", { hasText: "Llegó Del Sitio QA" })).toBeVisible();
      await expect(page.locator(".prospect-card", { hasText: "Ya Estaba QA" })).toBeVisible();
    });
  });
});

import { test, expect, ADMIN } from "./fixtures.js";
import { totpCode } from "../src/lib/totp.js";

// Puntos 84–85: verificación en dos pasos (en modo demo con un TOTP real), cierre por inactividad y dispositivos.

async function activarDosPasos(page, go, press) {
  await go("/admin/seguridad");
  await press(page.getByRole("button", { name: "Activar verificación en dos pasos" }));
  const secret = (await page.locator(".admin-security__enroll code").textContent()).trim();
  await expect(page.locator(".admin-security__qr canvas")).toBeVisible();
  await page.fill("#mfa-enroll-code", "000000");
  await press(page.getByRole("button", { name: "Confirmar y activar" }));
  await expect(page.locator(".admin-security__enroll .form-error")).toBeVisible();
  await page.fill("#mfa-enroll-code", await totpCode(secret));
  await press(page.getByRole("button", { name: "Confirmar y activar" }));
  await expect(page.getByRole("status").filter({ hasText: "está activada" })).toBeVisible();
  return secret;
}

test.describe("Verificación en dos pasos", () => {
  test("se activa con un código real, y el siguiente inicio de sesión lo pide", async ({ page, go, press, isMobile, seedAdminSession }) => {
    await seedAdminSession();
    const secret = await activarDosPasos(page, go, press);

    // Cerrar sesión y entrar de nuevo: contraseña correcta → falta el código.
    if (isMobile) await press(page.locator(".admin-layout__menu-btn"));
    await press(page.locator(".admin-layout__logout"));
    await page.waitForURL("**/admin/login");
    await page.fill("#admin-email", ADMIN.email);
    await page.fill("#admin-password", ADMIN.password);
    await press(page.locator("button[type=submit]"));
    await expect(page.locator("#mfa-code")).toBeVisible();
    await expect(page.locator(".admin-layout__content")).toHaveCount(0); // el panel no se abrió

    await page.fill("#mfa-code", "123456");
    await press(page.locator("button[type=submit]"));
    await expect(page.locator(".form-error")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.fill("#mfa-code", await totpCode(secret));
    await press(page.locator("button[type=submit]"));
    await page.waitForURL("**/admin");
    await expect(page.locator(".admin-layout__content h1").first()).toBeVisible();
  });

  test("con el segundo paso pendiente, entrar directo a una ruta del panel lleva al código", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await activarDosPasos(page, go, press);
    // Otra «sesión» del navegador: se pierde la confirmación del código, pero sigue la contraseña.
    await page.evaluate(() => sessionStorage.clear());
    await go("/admin/propiedades");
    await expect(page.locator("#mfa-code")).toBeVisible();
    await press(page.getByRole("button", { name: "Usar otra cuenta" }));
    await expect(page.locator("#admin-email")).toBeVisible();
  });

  test("se puede quitar desde Seguridad", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await activarDosPasos(page, go, press);
    await press(page.getByRole("button", { name: "Quitar" }));
    await expect(page.getByRole("button", { name: "Activar verificación en dos pasos" })).toBeVisible();
  });
});

test.describe("Cierre por inactividad y dispositivos", () => {
  test("avisa, deja seguir y, sin actividad, cierra la sesión con su explicación", async ({ page, go, press, seedAdminSession }) => {
    test.setTimeout(45_000);
    await seedAdminSession();
    await page.addInitScript(() => {
      window.__ACL_IDLE_LIMIT_MS__ = 6000;
    });
    await go("/admin/propiedades");
    const aviso = page.getByRole("alertdialog");
    await expect(aviso).toBeVisible({ timeout: 8000 });
    await press(aviso.getByRole("button", { name: "Seguir aquí" }));
    await expect(aviso).toHaveCount(0);
    // Sin tocar nada se vence (la última actividad es el clic de «Seguir aquí»).
    await page.waitForURL("**/admin/login", { timeout: 15_000 });
    await expect(page.getByText("Cerramos tu sesión por inactividad")).toBeVisible();
  });

  test("el dispositivo actual aparece en la lista y «cerrar las demás» deja solo este", async ({ page, go, press, seedAdminSession }) => {
    await seedAdminSession();
    await page.addInitScript(() => {
      localStorage.setItem("acl_local_devices", JSON.stringify([{ device_id: "otro-dispositivo-1", label: "Firefox en Linux", first_seen: "2026-11-01T10:00:00Z", last_seen: "2026-11-02T10:00:00Z" }]));
    });
    await go("/admin/seguridad");
    await expect(page.locator(".admin-security__list li", { hasText: "(este)" })).toBeVisible();
    await expect(page.locator(".admin-security__list li", { hasText: "Firefox en Linux" })).toBeVisible();
    await press(page.getByRole("button", { name: "Cerrar sesión en los demás dispositivos" }));
    await expect(page.locator(".admin-security__list li", { hasText: "Firefox en Linux" })).toHaveCount(0);
    await expect(page.locator(".admin-security__list li", { hasText: "(este)" })).toBeVisible();
  });
});

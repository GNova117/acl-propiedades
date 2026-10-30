import { defineConfig } from "@playwright/test";

// Pruebas de navegador (PC y móvil) del sitio y del panel admin. Ver e2e/README.md.
//
// Corren contra un build de producción servido con `vite preview`, y SIEMPRE en
// modo demo: las variables de Supabase se fuerzan a vacío (ver `webServer.env`),
// así que las pruebas nunca tocan una base real aunque exista un .env. Todo vive
// en el localStorage de cada prueba, que arranca limpio.

const PORT = Number(process.env.E2E_PORT) || 4173;
const baseURL = `http://127.0.0.1:${PORT}`;

// Chromium emulando un iPhone (tamaño, toques y user agent). No se usa
// devices["iPhone 13"] porque ese perfil exige WebKit y aquí solo hay Chromium.
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  globalSetup: "./e2e/global-setup.js",
  outputDir: "./test-results",
  timeout: 30_000,
  expect: { timeout: 6_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "es-MX",
    // Sin service worker: en el build de producción cachearía respuestas entre pruebas.
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1366, height: 800 } } },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: IPHONE_UA,
      },
    },
  ],
  webServer: {
    // dist-e2e (no dist) para no pisar el build de nadie.
    command: `npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    // Nunca reutilizar un servidor ya corriendo: podría estar construido con un .env real.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
      VITE_GA_MEASUREMENT_ID: "",
      VITE_VAPID_PUBLIC_KEY: "",
    },
  },
});

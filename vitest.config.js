import { defineConfig } from "vitest/config";

export default defineConfig({
  // Los componentes usan el JSX moderno (sin importar React en cada archivo), igual que en la app.
  esbuild: { jsx: "automatic" },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "src/**/*.test.jsx", "scripts/*.test.js", "supabase/*.test.js", "supabase/functions/**/*.test.js", "server/*.test.js"],
    // 494: reporte de cobertura (npm run test:coverage). Mide la lógica (lib, servidor y funciones de Supabase); las pantallas
    // de React se prueban con e2e, no con Vitest.
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.js", "server/**/*.js", "supabase/functions/_shared/**/*.js"],
      exclude: ["**/*.test.js", "src/lib/backend/**", "src/lib/seedData.js"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
    },
  },
});

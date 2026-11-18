import { defineConfig } from "vitest/config";

export default defineConfig({
  // Los componentes usan el JSX moderno (sin importar React en cada archivo), igual que en la app.
  esbuild: { jsx: "automatic" },
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "scripts/*.test.js", "supabase/*.test.js", "supabase/functions/**/*.test.js", "server/*.test.js"],
  },
});

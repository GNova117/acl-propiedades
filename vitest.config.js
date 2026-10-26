import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "supabase/functions/**/*.test.js"],
  },
});

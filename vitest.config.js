import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "scripts/*.test.js", "supabase/*.test.js", "supabase/functions/**/*.test.js"],
  },
});

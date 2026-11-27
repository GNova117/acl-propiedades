import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// 226: el sitio público no inicializa la sesión de Supabase Auth: AuthProvider vive solo dentro del panel (AuthShell).
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("alcance de la sesión", () => {
  it("main.jsx no monta AuthProvider para todo el sitio", () => {
    expect(read("../main.jsx")).not.toMatch(/AuthProvider/);
  });
  it("las rutas del panel están dentro de AuthShell", () => {
    const app = read("../App.jsx");
    const shell = app.indexOf("<Route element={<AuthShell />}>");
    expect(shell).toBeGreaterThan(-1);
    expect(app.indexOf('path="/admin/login"')).toBeGreaterThan(shell);
    expect(app.indexOf('path="/admin"\n')).toBeGreaterThan(shell);
  });
  it("las páginas y piezas públicas no piden la sesión del panel", () => {
    for (const file of ["../pages/PropertyDetail.jsx", "../pages/Properties.jsx", "../components/Header.jsx", "../components/Footer.jsx", "../components/ChatWidget.jsx"]) {
      expect(read(file), file).not.toMatch(/useAuth/);
    }
  });
});

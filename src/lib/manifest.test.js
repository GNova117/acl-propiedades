import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADMIN_MANIFEST, PUBLIC_MANIFEST, appTitleFor, applyManifest, manifestFor } from "./manifest";

describe("manifestFor", () => {
  it("el panel usa el suyo y todo lo demás el público", () => {
    expect(manifestFor("/admin")).toBe(ADMIN_MANIFEST);
    expect(manifestFor("/admin/propiedades")).toBe(ADMIN_MANIFEST);
    expect(manifestFor("/administracion")).toBe(PUBLIC_MANIFEST);
    expect(manifestFor("/")).toBe(PUBLIC_MANIFEST);
    expect(manifestFor("/propiedades/casa-ACL-1")).toBe(PUBLIC_MANIFEST);
    expect(appTitleFor("/admin/agenda")).toBe("ACL Panel");
    expect(appTitleFor("/contacto")).toBe("ACL Propiedades");
  });

  it("applyManifest cambia el enlace y el nombre de iOS solo si hace falta", () => {
    const attrs = { link: PUBLIC_MANIFEST, title: "ACL Propiedades" };
    const doc = { querySelector: (sel) => (sel.includes("manifest") ? { getAttribute: () => attrs.link, setAttribute: (_k, v) => (attrs.link = v) } : { setAttribute: (_k, v) => (attrs.title = v) }) };
    applyManifest("/admin/login", doc);
    expect(attrs).toEqual({ link: ADMIN_MANIFEST, title: "ACL Panel" });
    applyManifest("/", doc);
    expect(attrs).toEqual({ link: PUBLIC_MANIFEST, title: "ACL Propiedades" });
  });
});

describe("los manifiestos y el script de arranque", () => {
  const read = (path) => JSON.parse(readFileSync(new URL(`../../public/${path}`, import.meta.url), "utf8"));
  for (const file of ["manifest.webmanifest", "manifest-public.webmanifest"]) {
    it(`${file}: iconos que existen, inicio dentro del alcance y accesos directos válidos`, () => {
      const manifest = read(file);
      expect(manifest.display).toBe("standalone");
      expect(manifest.start_url.startsWith(manifest.scope === "/" ? "/" : manifest.scope)).toBe(true);
      for (const icon of manifest.icons) expect(existsSync(new URL(`../../public${icon.src}`, import.meta.url)), icon.src).toBe(true);
      expect(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
      for (const shortcut of manifest.shortcuts) expect(shortcut.url.startsWith("/")).toBe(true);
    });
  }

  it("la app pública se llama ACL Propiedades y la del panel ACL Panel, con inicios distintos", () => {
    const pub = read("manifest-public.webmanifest");
    const admin = read("manifest.webmanifest");
    expect(pub.short_name).toBe("ACL");
    expect(admin.short_name).toBe("ACL Panel");
    expect(pub.start_url).not.toBe(admin.start_url);
    expect(admin.start_url).toBe("/admin");
  });

  it("index.html enlaza el manifiesto público y carga el script que elige entre ambos", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    expect(html).toContain('<link rel="manifest" href="/manifest-public.webmanifest" />');
    expect(html).toContain('<script src="/manifest-switch.js"></script>');
    const script = readFileSync(new URL("../../public/manifest-switch.js", import.meta.url), "utf8");
    expect(script).toContain("/manifest.webmanifest");
    expect(script).toContain("/manifest-public.webmanifest");
  });
});

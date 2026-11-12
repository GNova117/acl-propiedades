import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDataCache, revalidate } from "./dataCache";
import { useQuery } from "./useQuery";

// Lo que ve la pantalla en el primer pintado (antes de que corra ningún efecto): con algo en el caché,
// la lista ya está ahí; sin nada, «cargando». Es lo que hace que cambiar de pantalla se sienta instantáneo.
const query = { key: "lista", fetch: async () => ["nuevo"] };
function Probe({ enabled = true }) {
  const { data, loading, error } = useQuery(query, { enabled });
  return createElement("p", null, loading ? "cargando" : error ? "error" : `datos:${(data || []).join(",")}`);
}

beforeEach(() => clearDataCache());

describe("useQuery: primer pintado", () => {
  it("sin nada en el caché muestra «cargando»", () => {
    expect(renderToString(createElement(Probe))).toContain("cargando");
  });

  it("con algo en el caché lo pinta de inmediato, sin pasar por «cargando»", async () => {
    await revalidate("lista", async () => ["guardado", "antes"]);
    const html = renderToString(createElement(Probe));
    expect(html).toContain("datos:guardado,antes");
    expect(html).not.toContain("cargando");
  });

  it("si la primera consulta falló no se queda «cargando» para siempre", async () => {
    await revalidate("lista", async () => Promise.reject(new Error("mal"))).catch(() => {});
    expect(renderToString(createElement(Probe))).toContain("error");
  });

  it("con enabled: false no carga nada (lista a la que el rol no tiene acceso)", () => {
    const html = renderToString(createElement(Probe, { enabled: false }));
    expect(html).toContain("datos:");
    expect(html).not.toContain("cargando");
  });
});

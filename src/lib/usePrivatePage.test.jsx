// @vitest-environment jsdom
// 499: el bloque común de las páginas con enlace secreto (robots, referrer y título).
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { usePrivatePage } from "./usePrivatePage";

afterEach(() => {
  cleanup();
  document.title = "";
});

const metas = (name) => [...document.head.querySelectorAll(`meta[name="${name}"]`)];

describe("usePrivatePage", () => {
  it("pone noindex/noarchive, no-referrer y el título, y lo quita al salir", () => {
    document.title = "Antes";
    const { unmount } = renderHook(() => usePrivatePage("Mi visita"));
    expect(metas("robots")[0].content).toBe("noindex, nofollow, noarchive");
    expect(metas("referrer")[0].content).toBe("no-referrer");
    expect(document.title).toBe("Mi visita | ACL Propiedades");
    unmount();
    expect(metas("robots")).toHaveLength(0);
    expect(metas("referrer")).toHaveLength(0);
    expect(document.title).toBe("Antes");
  });

  it("sin título no toca el de la pestaña", () => {
    document.title = "Se queda";
    renderHook(() => usePrivatePage(undefined));
    expect(document.title).toBe("Se queda");
    expect(metas("robots")).toHaveLength(1);
  });

  it("al cambiar el título (p. ej. el idioma) no deja metas repetidas", () => {
    const { rerender } = renderHook(({ title }) => usePrivatePage(title), { initialProps: { title: "Uno" } });
    rerender({ title: "Dos" });
    expect(metas("robots")).toHaveLength(1);
    expect(document.title).toBe("Dos | ACL Propiedades");
  });

  it("con robots:false solo agrega el «referrer» (la página ya pone su propio noindex)", () => {
    renderHook(() => usePrivatePage(undefined, { robots: false }));
    expect(metas("robots")).toHaveLength(0);
    expect(metas("referrer")).toHaveLength(1);
  });
});

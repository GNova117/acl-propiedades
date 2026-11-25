import { describe, expect, it, vi } from "vitest";

vi.mock("../../supabaseClient", () => ({ supabase: {} }));

const { fetchAll, PAGE_SIZE, MAX_PAGES } = await import("./shared.js");

// Una "consulta" falsa que responde por rangos, como PostgREST con max-rows = 1000.
function fakeTable(total) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls = [];
  const build = () => ({
    range: async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    },
  });
  return { build, calls };
}

describe("fetchAll", () => {
  it("trae todo cuando hay más de 1000 filas", async () => {
    const { build, calls } = fakeTable(2350);
    const rows = await fetchAll(build);
    expect(rows).toHaveLength(2350);
    expect(rows[2349].id).toBe(2349);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("con menos de una página hace una sola petición", async () => {
    const { build, calls } = fakeTable(12);
    expect(await fetchAll(build)).toHaveLength(12);
    expect(calls).toHaveLength(1);
  });

  it("con una tabla vacía devuelve []", async () => {
    const { build } = fakeTable(0);
    expect(await fetchAll(build)).toEqual([]);
  });

  it("con exactamente una página pide una más y se detiene", async () => {
    const { build, calls } = fakeTable(PAGE_SIZE);
    expect(await fetchAll(build)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it("propaga el error de la base", async () => {
    const boom = new Error("rls");
    await expect(fetchAll(() => ({ range: async () => ({ data: null, error: boom }) }))).rejects.toBe(boom);
  });

  it("tiene un tope de páginas para no ciclar", async () => {
    let n = 0;
    await fetchAll(() => ({ range: async () => ({ data: Array.from({ length: PAGE_SIZE }, () => ({})), error: (n += 1) && null }) }));
    expect(n).toBe(MAX_PAGES);
  });
});

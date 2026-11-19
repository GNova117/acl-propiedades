import { describe, expect, it } from "vitest";
import { HELP_TOPICS, isTourSeen, markTourSeen, searchTopics, tourSteps, visibleTopics } from "./helpTopics";

const has = (...sections) => (s) => sections.includes(s);

describe("visibleTopics / tourSteps", () => {
  it("cada quien ve solo los temas de sus apartados, y «mi cuenta» siempre", () => {
    expect(visibleTopics(has("agenda")).map((t) => t.key)).toEqual(["myDay", "agenda", "account"]);
    expect(visibleTopics(has()).map((t) => t.key)).toEqual(["account"]);
    expect(visibleTopics(has("roles", "liquidaciones")).map((t) => t.key)).toEqual(["commissions", "roles", "account"]);
    expect(visibleTopics(() => true)).toHaveLength(HELP_TOPICS.length);
  });

  it("el recorrido empieza en la bienvenida, sigue con lo que puede usar y cierra con dónde está la ayuda", () => {
    expect(tourSteps(has("prospectos", "agenda", "propiedades"))).toEqual(["welcome", "myDay", "prospects", "agenda", "properties", "help"]);
    expect(tourSteps(has("agenda"))).toEqual(["welcome", "myDay", "agenda", "help"]);
    expect(tourSteps(has())).toEqual(["welcome", "help"]);
  });
});

describe("searchTopics", () => {
  const topics = [{ key: "a" }, { key: "b" }];
  const text = (t) => ({ a: "Duplicar una propiedad y editar en lote", b: "Contraseña olvidada" })[t.key];
  it("busca sin importar acentos ni mayúsculas y pide todas las palabras", () => {
    expect(searchTopics(topics, "CONTRASEÑA", text)).toEqual([{ key: "b" }]);
    expect(searchTopics(topics, "contrasena", text)).toEqual([{ key: "b" }]);
    expect(searchTopics(topics, "duplicar lote", text)).toEqual([{ key: "a" }]);
    expect(searchTopics(topics, "duplicar contraseña", text)).toEqual([]);
    expect(searchTopics(topics, "  ", text)).toEqual(topics);
  });
});

describe("recorrido visto", () => {
  it("se recuerda por persona y tolera un almacenamiento roto", () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
    expect(isTourSeen("Ana@x.mx", storage)).toBe(false);
    markTourSeen("ana@x.mx", storage);
    expect(isTourSeen("ANA@x.mx", storage)).toBe(true);
    expect(isTourSeen("beto@x.mx", storage)).toBe(false);
    expect(isTourSeen("x", { getItem: () => { throw new Error("bloqueado"); } })).toBe(true);
    expect(() => markTourSeen("x", { setItem: () => { throw new Error("lleno"); } })).not.toThrow();
  });
});

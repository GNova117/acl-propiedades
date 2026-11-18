import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/fonts.css", import.meta.url), "utf8");

describe("fuentes propias", () => {
  it("declara Inter (400–700) y Rajdhani (500–700) con archivos que existen", () => {
    const faces = [...css.matchAll(/font-family: "([^"]+)";[\s\S]*?font-weight: (\d+);[\s\S]*?url\("([^"]+)"\)/g)];
    expect(faces.map(([, family, weight]) => `${family} ${weight}`)).toEqual(["Inter 400", "Inter 500", "Inter 600", "Inter 700", "Rajdhani 500", "Rajdhani 600", "Rajdhani 700"]);
    for (const [, , , path] of faces) expect(existsSync(new URL(`../src/${path}`, import.meta.url)), path).toBe(true);
  });

  it("todas con font-display: swap (el texto se ve mientras carga la fuente)", () => {
    expect(css.match(/font-display: swap/g)).toHaveLength(7);
  });
});

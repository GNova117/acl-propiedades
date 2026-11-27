import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 490: estas dependencias son SOLO de servidor (api/, server/, supabase/functions/, scripts/). Si algo bajo src/ (el
// navegador) las importa, el paquete del sitio se infla o rompe. Ver docs/dependencias-servidor.md.
const SERVER_ONLY = ["@anthropic-ai/sdk", "@napi-rs/canvas", "google-auth-library"];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("dependencias solo de servidor", () => {
  it("ningún archivo del navegador (src/) las importa", () => {
    const offenders = [];
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      for (const dep of SERVER_ONLY) {
        if (new RegExp(`from\\s+["']${dep}["']|import\\(\\s*["']${dep}["']|require\\(\\s*["']${dep}["']`).test(text)) offenders.push(`${file} → ${dep}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

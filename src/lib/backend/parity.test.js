import { describe, expect, it } from "vitest";
import { localBackend } from "../localBackend";
import { supabaseBackend } from "../supabaseBackend";

// El sitio habla con `db`, que es supabaseBackend (producción) o localBackend (modo demo). Las pantallas llaman al mismo método
// por nombre, así que si uno de los dos no lo tiene, esa pantalla truena solo en uno de los modos. Esta prueba compara los dos.
// Los ayudantes internos (nombre con «_») son de cada implementación y no cuentan; lo demás debe existir en los dos. La única
// diferencia a propósito está en esta lista, con su motivo.
const SOLO_DEMO = new Set([
  "demoCredentials", // credenciales de la cuenta demo (en producción no hay cuenta de ejemplo)
]);

const names = (backend) => Object.keys(backend).filter((k) => !k.startsWith("_") && (typeof backend[k] === "function" || k === "mode" || k === "demoCredentials"));

describe("paridad entre los dos backends", () => {
  const supabase = new Set(names(supabaseBackend));
  const local = new Set(names(localBackend));

  it("cada método de Supabase existe también en el modo demo (salvo lo marcado a propósito)", () => {
    const missingInLocal = [...supabase].filter((n) => !local.has(n));
    expect(missingInLocal, "falta en localBackend").toEqual([]);
  });

  it("cada método del modo demo existe también en Supabase (salvo lo marcado a propósito)", () => {
    const missingInSupabase = [...local].filter((n) => !supabase.has(n) && !SOLO_DEMO.has(n));
    expect(missingInSupabase, "falta en supabaseBackend").toEqual([]);
  });

  it("los modos se identifican", () => {
    expect(supabaseBackend.mode).toBe("supabase");
    expect(localBackend.mode).toBe("local");
  });
});

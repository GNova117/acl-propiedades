import { describe, expect, it } from "vitest";
import {
  MAX_SELECTION,
  NOTE_MAX,
  OPEN_CUE_DAYS,
  SELECTION_VALID_DAYS,
  TITLE_MAX,
  agoText,
  cleanSelectionInput,
  defaultSelectionTitle,
  openedSelection,
  selectionState,
  selectionUrl,
  selectionsFor,
  suggestedPicks,
  togglePick,
} from "./selections";
import { selectionShareMessage } from "./propertyShare";

const NOW = new Date("2026-11-13T12:00:00Z");
const ago = (hours) => new Date(NOW.getTime() - hours * 36e5).toISOString();
const sel = (over = {}) => ({
  id: "s1",
  token: "a".repeat(32),
  prospecto_id: "p1",
  property_ids: ["x", "y"],
  created_at: ago(30),
  expires_at: new Date(NOW.getTime() + 30 * 864e5).toISOString(),
  open_count: 0,
  first_opened_at: null,
  last_opened_at: null,
  revoked_at: null,
  ...over,
});

describe("armar la selección", () => {
  it("el enlace público", () => {
    expect(selectionUrl("https://aclpropiedades.com", "abc")).toBe("https://aclpropiedades.com/seleccion/abc");
  });

  it("título de partida con el primer nombre, o genérico", () => {
    expect(defaultSelectionTitle("Ana María López")).toBe("Propiedades para Ana");
    expect(defaultSelectionTitle("")).toBe("Propiedades para ti");
    expect(defaultSelectionTitle(null)).toBe("Propiedades para ti");
  });

  it("togglePick agrega, quita y respeta el máximo sin repetir", () => {
    expect(togglePick([], "a")).toEqual(["a"]);
    expect(togglePick(["a", "b"], "a")).toEqual(["b"]);
    const full = Array.from({ length: MAX_SELECTION }, (_, i) => `p${i}`);
    expect(togglePick(full, "otra")).toEqual(full);
    expect(togglePick(full, "p3")).toHaveLength(MAX_SELECTION - 1);
  });

  it("suggestedPicks toma las primeras coincidencias, sin pasar del límite", () => {
    const matches = Array.from({ length: 9 }, (_, i) => ({ id: `m${i}` }));
    expect(suggestedPicks(matches)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(suggestedPicks(matches, 2)).toEqual(["m0", "m1"]);
    expect(suggestedPicks(matches, 99)).toHaveLength(9);
    expect(suggestedPicks([])).toEqual([]);
  });

  it("cleanSelectionInput quita repetidas y vacías, recorta a los límites de la tabla y usa null en lo vacío", () => {
    const many = Array.from({ length: 20 }, (_, i) => `p${i}`);
    const out = cleanSelectionInput({ propertyIds: [...many, "p0"], title: ` ${"t".repeat(300)} `, note: "  " });
    expect(out.property_ids).toHaveLength(MAX_SELECTION);
    expect(out.title).toHaveLength(TITLE_MAX);
    expect(out.note).toBeNull();
    expect(cleanSelectionInput({ propertyIds: ["a"], note: "n".repeat(NOTE_MAX + 50) }).note).toHaveLength(NOTE_MAX);
    expect(cleanSelectionInput({ propertyIds: undefined })).toEqual({ property_ids: [], title: null, note: null });
  });

  it("la vigencia coincide con la de la tabla (60 días)", () => {
    expect(SELECTION_VALID_DAYS).toBe(60);
  });
});

describe("selectionState", () => {
  it("sin abrir, abierta, vencida y desactivada (la desactivada manda sobre todo)", () => {
    expect(selectionState(sel(), NOW)).toBe("sent");
    expect(selectionState(sel({ open_count: 3 }), NOW)).toBe("opened");
    expect(selectionState(sel({ open_count: 3, expires_at: ago(1) }), NOW)).toBe("expired");
    expect(selectionState(sel({ open_count: 3, revoked_at: ago(2), expires_at: ago(1) }), NOW)).toBe("revoked");
  });
});

describe("selectionsFor", () => {
  it("solo las del prospecto, la más reciente primero", () => {
    const list = [sel({ id: "a", created_at: ago(50) }), sel({ id: "b", created_at: ago(10) }), sel({ id: "c", prospecto_id: "otro" })];
    expect(selectionsFor("p1", list).map((s) => s.id)).toEqual(["b", "a"]);
    expect(selectionsFor("p1", undefined)).toEqual([]);
  });
});

describe("openedSelection (la señal para el seguimiento)", () => {
  const prospect = (over = {}) => ({ id: "p1", stage: "contactado", last_contact_at: ago(48), ...over });
  const opened = (over = {}) => sel({ open_count: 2, first_opened_at: ago(5), last_opened_at: ago(3), ...over });

  it("la abrió hace poco y nadie le ha escrito desde entonces: es la señal", () => {
    expect(openedSelection(prospect(), [opened()], NOW)?.id).toBe("s1");
  });

  it("sin contacto previo también cuenta", () => {
    expect(openedSelection(prospect({ last_contact_at: null }), [opened()], NOW)).not.toBeNull();
  });

  it("si ya se le contactó después de abrirla, deja de ser señal", () => {
    expect(openedSelection(prospect({ last_contact_at: ago(1) }), [opened()], NOW)).toBeNull();
  });

  it("sin abrir, vencida o desactivada no es señal", () => {
    expect(openedSelection(prospect(), [sel()], NOW)).toBeNull();
    expect(openedSelection(prospect(), [opened({ expires_at: ago(1) })], NOW)).toBeNull();
    expect(openedSelection(prospect(), [opened({ revoked_at: ago(1) })], NOW)).toBeNull();
  });

  it("pasados OPEN_CUE_DAYS días ya no se destaca", () => {
    const untouched = prospect({ last_contact_at: null }); // sin contacto posterior: solo cuenta el tiempo
    expect(openedSelection(untouched, [opened({ last_opened_at: ago(OPEN_CUE_DAYS * 24 + 1) })], NOW)).toBeNull();
    expect(openedSelection(untouched, [opened({ last_opened_at: ago(OPEN_CUE_DAYS * 24 - 1) })], NOW)).not.toBeNull();
  });

  it("solo prospectos en etapas abiertas, y de la selección de ese prospecto", () => {
    expect(openedSelection(prospect({ stage: "cerrado" }), [opened()], NOW)).toBeNull();
    expect(openedSelection(prospect({ stage: "perdido" }), [opened()], NOW)).toBeNull();
    expect(openedSelection(prospect(), [opened({ prospecto_id: "otro" })], NOW)).toBeNull();
  });

  it("con varias, la abierta más recientemente", () => {
    const list = [opened({ id: "vieja", last_opened_at: ago(30) }), opened({ id: "nueva", last_opened_at: ago(2) })];
    expect(openedSelection(prospect(), list, NOW).id).toBe("nueva");
  });
});

describe("agoText", () => {
  it("minutos, horas, ayer y días, en español", () => {
    expect(agoText(ago(0.5), "es", NOW)).toBe("hace 30 minutos");
    expect(agoText(ago(3), "es", NOW)).toBe("hace 3 horas");
    expect(agoText(ago(30), "es", NOW)).toBe("ayer");
    expect(agoText(ago(24 * 5), "es", NOW)).toBe("hace 5 días");
  });
  it("lo recién pasado y lo inválido", () => {
    expect(agoText(NOW.toISOString(), "es", NOW)).toMatch(/ahora/);
    expect(agoText(null, "es", NOW)).toBe("");
    expect(agoText("no es fecha", "es", NOW)).toBe("");
  });
});

describe("selectionShareMessage", () => {
  const url = "https://x.mx/seleccion/abc";
  it("saluda por el primer nombre, dice cuántas lleva, trae el enlace y la firma", () => {
    const text = selectionShareMessage({ url, count: 4, recipientName: "Luis Pérez", advisorName: "Ana" });
    expect(text).toContain("Hola Luis,");
    expect(text).toContain("4 propiedades");
    expect(text).toContain(`🔗 ${url}`);
    expect(text).toContain("— Ana, ACL Propiedades");
  });
  it("una sola en singular; sin nombre ni asesor, sin firma", () => {
    const text = selectionShareMessage({ url, count: 1 });
    expect(text).toContain("Hola,");
    expect(text).toContain("una propiedad");
    expect(text).not.toContain("— ");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const session = { token: null };
vi.mock("./supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }) } },
}));

const { loadLetterhead, resetLetterheadCache } = await import("./letterhead");
const { PDFDocument } = await import("pdf-lib");

const pdfPages = async (bytes) => (await PDFDocument.load(bytes)).getPageCount();

async function realTemplate() {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  return doc.save();
}

describe("loadLetterhead", () => {
  beforeEach(() => {
    resetLetterheadCache();
    session.token = null;
    vi.unstubAllGlobals();
  });

  it("sin sesión usa una hoja carta en blanco y no pide nada al servidor", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const bytes = await loadLetterhead();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await pdfPages(bytes)).toBe(1);
  });

  it("con sesión y acceso baja la hoja real, con el token, una sola vez por sesión", async () => {
    session.token = "jwt-asesor";
    const template = await realTemplate();
    const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => template.buffer.slice(template.byteOffset, template.byteOffset + template.byteLength) }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await pdfPages(await loadLetterhead())).toBe(2);
    await loadLetterhead();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/plantilla", { headers: { Authorization: "Bearer jwt-asesor" } });
  });

  it("con sesión pero sin el apartado (403) sale con hoja en blanco, sin fallar", async () => {
    session.token = "jwt-sin-acceso";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 403 })));
    expect(await pdfPages(await loadLetterhead())).toBe(1);
  });

  it("si la red falla sale con hoja en blanco", async () => {
    session.token = "jwt";
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("sin red");
    }));
    expect(await pdfPages(await loadLetterhead())).toBe(1);
  });

  it("vuelve a pedir la hoja si cambia la sesión (otro usuario, otro rol)", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    session.token = "uno";
    await loadLetterhead();
    session.token = "dos";
    await loadLetterhead();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

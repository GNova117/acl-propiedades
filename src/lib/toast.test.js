import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetToastsForTests, confirmDialog, dismiss, flushPendingDeletes, getConfirmRequest, getToasts, looksLikeFailure, notify, promptDialog, resolveConfirm, subscribe, toast, undoableDelete } from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
  __resetToastsForTests();
});
afterEach(() => {
  vi.useRealTimers();
  delete globalThis.__ACL_AUTO_CONFIRM__;
});

describe("avisos", () => {
  it("notify pinta como error lo que cuenta que algo falló y como info lo demás", () => {
    notify("No se pudo guardar. Inténtalo de nuevo.");
    notify("Listo: 3 actualizados.");
    expect(getToasts().map((t) => t.type)).toEqual(["error", "info"]);
    expect(looksLikeFailure("Could not save")).toBe(true);
    expect(looksLikeFailure("Error al dar acceso")).toBe(true);
    expect(looksLikeFailure("Copiado")).toBe(false);
  });

  it("ignora vacíos, no repite el mismo aviso y deja ver solo los últimos 4", () => {
    toast.show("   ");
    toast.show("uno");
    toast.show("uno");
    expect(getToasts()).toHaveLength(1);
    ["a", "b", "c", "d", "e"].forEach((m) => toast.show(m));
    expect(getToasts().map((t) => t.message)).toEqual(["b", "c", "d", "e"]);
  });

  it("los errores duran más y se pueden cerrar; los suscriptores se enteran", () => {
    const seen = vi.fn();
    const off = subscribe(seen);
    const id = toast.error("falló");
    expect(getToasts()[0].duration).toBeGreaterThan(toast.show("ok") ? getToasts()[1].duration : 0);
    dismiss(id);
    expect(getToasts().some((t) => t.id === id)).toBe(false);
    expect(seen).toHaveBeenCalled();
    off();
  });
});

describe("confirmDialog", () => {
  it("espera la respuesta de la persona", async () => {
    const answer = confirmDialog("¿Borrar?", { danger: true });
    expect(getConfirmRequest()).toMatchObject({ message: "¿Borrar?", opts: { danger: true } });
    resolveConfirm(true);
    await expect(answer).resolves.toBe(true);
    expect(getConfirmRequest()).toBeNull();

    const no = confirmDialog("¿Seguro?");
    resolveConfirm(false);
    await expect(no).resolves.toBe(false);
  });

  it("una segunda pregunta cancela la primera (solo hay una a la vez)", async () => {
    const first = confirmDialog("uno");
    const second = confirmDialog("dos");
    await expect(first).resolves.toBe(false);
    expect(getConfirmRequest().message).toBe("dos");
    resolveConfirm(true);
    await expect(second).resolves.toBe(true);
  });

  it("en las pruebas de navegador se acepta sola", async () => {
    globalThis.__ACL_AUTO_CONFIRM__ = true;
    await expect(confirmDialog("¿?")).resolves.toBe(true);
    expect(getConfirmRequest()).toBeNull();
  });
});

describe("undoableDelete", () => {
  it("borra al pasar el tiempo si nadie lo deshace", async () => {
    const commit = vi.fn(async () => {});
    undoableDelete("Eliminado", { commit, onUndo: vi.fn() });
    expect(commit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(7000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("«Deshacer» cancela el borrado y avisa para volver a poner el elemento", async () => {
    const commit = vi.fn(async () => {});
    const onUndo = vi.fn();
    undoableDelete("Eliminado", { commit, onUndo });
    getToasts()[0].action.onClick();
    await vi.advanceTimersByTimeAsync(20000);
    expect(commit).not.toHaveBeenCalled();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(getToasts()).toHaveLength(0);
  });

  it("al salir de la página se borra de inmediato lo pendiente, una sola vez", async () => {
    const commit = vi.fn(async () => {});
    undoableDelete("Eliminado", { commit });
    flushPendingDeletes();
    flushPendingDeletes();
    await vi.advanceTimersByTimeAsync(20000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("si el borrado falla lo avisa para que quien llama vuelva a poner el elemento", async () => {
    const onError = vi.fn();
    undoableDelete("Eliminado", { commit: async () => { throw new Error("rls"); }, onError });
    await vi.advanceTimersByTimeAsync(7000);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "rls" }));
  });
});

describe("promptDialog (reemplaza a window.prompt)", () => {
  it("devuelve lo escrito al aceptar y null al cancelar", async () => {
    const accepted = promptDialog("Motivo", { defaultValue: "" });
    expect(getConfirmRequest().opts.input).toBe(true);
    resolveConfirm(true, "cliente canceló");
    await expect(accepted).resolves.toBe("cliente canceló");

    const cancelled = promptDialog("Motivo");
    resolveConfirm(false);
    await expect(cancelled).resolves.toBeNull();
  });

  it("aceptar sin escribir devuelve cadena vacía (el motivo es opcional)", async () => {
    const p = promptDialog("Motivo");
    resolveConfirm(true, "");
    await expect(p).resolves.toBe("");
  });

  it("una confirmación normal sigue devolviendo true/false", async () => {
    const yes = confirmDialog("¿Seguro?");
    resolveConfirm(true, "ignorado");
    await expect(yes).resolves.toBe(true);
    const no = confirmDialog("¿Seguro?");
    resolveConfirm(false);
    await expect(no).resolves.toBe(false);
  });

  it("en las pruebas de navegador (auto-confirmar) responde con el valor por omisión", async () => {
    globalThis.__ACL_AUTO_CONFIRM__ = true;
    await expect(promptDialog("Motivo", { defaultValue: "x" })).resolves.toBe("x");
  });
});

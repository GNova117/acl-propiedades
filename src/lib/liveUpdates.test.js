import { describe, expect, it, vi } from "vitest";
import { createLiveBus, startLiveUpdates } from "./liveUpdates";

describe("createLiveBus", () => {
  it("reparte solo las tablas pedidas y deja de repartir al cancelar", () => {
    const bus = createLiveBus();
    const messages = vi.fn();
    const all = vi.fn();
    const stop = bus.subscribe(["contact_messages"], messages);
    bus.subscribe(null, all);
    bus.emit({ table: "contact_messages", type: "INSERT" });
    bus.emit({ table: "prospectos", type: "UPDATE" });
    expect(messages).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledTimes(2);
    stop();
    bus.emit({ table: "contact_messages", type: "INSERT" });
    expect(messages).toHaveBeenCalledTimes(1);
    expect(bus.size).toBe(1);
  });

  it("un oyente que falla no calla a los demás", () => {
    const bus = createLiveBus();
    const ok = vi.fn();
    bus.subscribe(null, () => {
      throw new Error("falló");
    });
    bus.subscribe(null, ok);
    expect(() => bus.emit({ table: "x" })).not.toThrow();
    expect(ok).toHaveBeenCalled();
  });
});

describe("startLiveUpdates", () => {
  it("abre el canal del backend, reparte sus eventos y lo cierra", () => {
    const bus = createLiveBus();
    const seen = vi.fn();
    bus.subscribe(null, seen);
    const close = vi.fn();
    let push;
    const db = { subscribeToChanges: (cb) => ((push = cb), close) };
    const stop = startLiveUpdates(db, bus);
    push({ table: "prospectos", type: "INSERT" });
    expect(seen).toHaveBeenCalledWith({ table: "prospectos", type: "INSERT" });
    stop();
    expect(close).toHaveBeenCalled();
  });

  it("sin soporte del backend, o si falla, no hace nada y no truena", () => {
    expect(startLiveUpdates({})).toBeTypeOf("function");
    expect(() => startLiveUpdates({ subscribeToChanges: () => { throw new Error("sin realtime"); } })()).not.toThrow();
  });
});

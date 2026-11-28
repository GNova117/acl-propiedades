import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Entorno node: se simula lo mínimo de window/localStorage.
function installWindow({ storageThrows = false } = {}) {
  const store = new Map();
  const listeners = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => {
        if (storageThrows) throw new Error("bloqueado");
        return store.has(k) ? store.get(k) : null;
      },
      setItem: (k, v) => {
        if (storageThrows) throw new Error("bloqueado");
        store.set(k, v);
      },
    },
    addEventListener: (name, fn) => listeners.set(name, [...(listeners.get(name) || []), fn]),
    removeEventListener: (name, fn) => listeners.set(name, (listeners.get(name) || []).filter((f) => f !== fn)),
    dispatchEvent: (event) => (listeners.get(event.type) || []).forEach((fn) => fn(event)),
  };
  globalThis.CustomEvent = class {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
  globalThis.Event = class {
    constructor(type) {
      this.type = type;
    }
  };
}

describe("consentimiento de cookies", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    delete globalThis.window;
    delete globalThis.CustomEvent;
    delete globalThis.Event;
  });

  it("empieza sin decisión y recuerda la que se elige", async () => {
    installWindow();
    const { getConsent, setConsent } = await import("./consent");
    expect(getConsent()).toBeNull();
    setConsent("granted");
    expect(getConsent()).toBe("granted");
    setConsent("denied");
    expect(getConsent()).toBe("denied");
  });

  it("ignora valores que no son una decisión", async () => {
    installWindow();
    const { getConsent, setConsent } = await import("./consent");
    setConsent("tal vez");
    expect(getConsent()).toBeNull();
  });

  it("avisa a quien escucha y deja de avisar al cancelar", async () => {
    installWindow();
    const { setConsent, subscribeConsent } = await import("./consent");
    const seen = [];
    const stop = subscribeConsent((value) => seen.push(value));
    setConsent("granted");
    stop();
    setConsent("denied");
    expect(seen).toEqual(["granted"]);
  });

  it("con el almacenamiento bloqueado la decisión vale mientras la pestaña siga abierta", async () => {
    installWindow({ storageThrows: true });
    const { getConsent, setConsent } = await import("./consent");
    expect(getConsent()).toBeNull();
    setConsent("denied");
    expect(getConsent()).toBe("denied");
  });
});

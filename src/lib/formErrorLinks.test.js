// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { firstInvalidControl, syncFormErrors } from "./formErrorLinks";

const montar = (html) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return root;
};

describe("syncFormErrors", () => {
  it("liga cada error a su campo (aria-invalid y aria-describedby)", () => {
    const root = montar('<form><div class="form-field"><label for="a">Nombre</label><input id="a" /><span class="form-error">Obligatorio</span></div></form>');
    syncFormErrors(root);
    const input = root.querySelector("input");
    const error = root.querySelector(".form-error");
    expect(error.id).toMatch(/^auto-err-/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
  });

  it("conserva un aria-describedby que el campo ya tenía y lo restaura cuando desaparece el error", () => {
    const root = montar('<div class="form-field"><input id="b" aria-describedby="ayuda" /><small id="ayuda">Ayuda</small><span class="form-error">Mal</span></div>');
    syncFormErrors(root);
    const input = root.querySelector("input");
    expect(input.getAttribute("aria-describedby")).toMatch(/^ayuda auto-err-/);
    root.querySelector(".form-error").remove();
    syncFormErrors(root);
    expect(input.getAttribute("aria-describedby")).toBe("ayuda");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("data-auto-err")).toBe(false);
  });

  it("no toca un campo que ya maneja su propio aria-invalid", () => {
    const root = montar('<div class="form-field"><input id="c" aria-invalid="true" aria-describedby="c-error" /><span id="c-error" class="form-error">Mal</span></div>');
    syncFormErrors(root);
    const input = root.querySelector("input");
    expect(input.getAttribute("aria-describedby")).toBe("c-error");
    expect(input.hasAttribute("data-auto-err")).toBe(false);
  });

  it("ignora errores sueltos (sin campo) y campos sin error", () => {
    const root = montar('<form><p class="form-error">Error general</p><div class="form-field"><input id="d" /></div></form>');
    syncFormErrors(root);
    expect(root.querySelector("input").hasAttribute("aria-invalid")).toBe(false);
    expect(root.querySelector("p").id).toBe("");
  });
});

describe("firstInvalidControl", () => {
  it("devuelve el primer campo con error en el orden del documento", () => {
    const root = montar(
      '<form><div class="form-field"><input id="x1" /></div><div class="form-field"><input id="x2" /><span class="form-error">Mal</span></div><div class="form-field"><select id="x3"></select><span class="form-error">Mal</span></div></form>',
    );
    syncFormErrors(root);
    expect(firstInvalidControl(root.querySelector("form")).id).toBe("x2");
    expect(firstInvalidControl(null)).toBeNull();
  });
});

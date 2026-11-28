import { useEffect } from "react";

// 261: errores de formulario accesibles en TODAS las pantallas, sin tocar los ~25 formularios del panel y los modales uno por uno.
//  · Cada `.form-error` dentro de un `.form-field` queda ligado a su campo (aria-describedby + aria-invalid): al llegar al campo, el
//    lector de pantalla dice el error. Un campo que ya trae su propio `aria-invalid` (Contacto, visitas, alertas…) no se toca.
//  · Al enviar un formulario con errores, el foco va al primer campo con error (antes se quedaba en el botón y quien usa teclado o
//    lector de pantalla no se enteraba de nada).
// El anuncio de los mensajes sueltos de error (`role="alert"`) va escrito en cada pantalla; esto cubre lo que falta: el campo.
const CONTROL = "input:not([type=hidden]), select, textarea";
const AUTO = "data-auto-err";
const WINDOW_MS = 1500; // lo que se espera, después de enviar, a que aparezcan los errores
let counter = 0;

const tokens = (value) => String(value || "").split(/\s+/).filter(Boolean);

export function syncFormErrors(root) {
  if (!root) return;
  for (const field of root.querySelectorAll(".form-field")) {
    const control = field.querySelector(CONTROL);
    if (!control) continue;
    const error = field.querySelector(".form-error");
    const linked = control.getAttribute(AUTO);
    if (error) {
      // Lo maneja la propia pantalla (tiene su aria-invalid): no se pisa.
      if (control.hasAttribute("aria-invalid") && !linked) continue;
      if (!error.id) error.id = `auto-err-${++counter}`;
      control.setAttribute("aria-invalid", "true");
      const ids = tokens(control.getAttribute("aria-describedby"));
      if (!ids.includes(error.id)) ids.push(error.id);
      control.setAttribute("aria-describedby", ids.join(" "));
      control.setAttribute(AUTO, error.id);
    } else if (linked) {
      control.removeAttribute("aria-invalid");
      const ids = tokens(control.getAttribute("aria-describedby")).filter((id) => id !== linked);
      if (ids.length) control.setAttribute("aria-describedby", ids.join(" "));
      else control.removeAttribute("aria-describedby");
      control.removeAttribute(AUTO);
    }
  }
}

// El primer campo con error dentro de `form`, en el orden del documento (o null).
export function firstInvalidControl(form) {
  if (!form) return null;
  for (const control of form.querySelectorAll(CONTROL)) {
    if (control.getAttribute("aria-invalid") === "true" && !control.disabled) return control;
  }
  return null;
}

// Se monta una vez por diseño (panel y sitio): observa el DOM, liga errores a campos y, tras un envío, enfoca el primero.
export function useFormErrorLinks() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let frame = 0;
    let submitted = null; // { form, at }

    const run = () => {
      syncFormErrors(document.body);
      if (submitted && performance.now() - submitted.at <= WINDOW_MS) {
        const target = firstInvalidControl(submitted.form);
        if (target) {
          submitted = null;
          if (document.activeElement !== target && typeof target.focus === "function") target.focus();
        }
      } else if (submitted) {
        submitted = null;
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(run);
    };
    const onSubmit = (e) => {
      submitted = { form: e.target instanceof HTMLFormElement ? e.target : e.target?.closest?.("form"), at: performance.now() };
      schedule();
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("submit", onSubmit, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);
}

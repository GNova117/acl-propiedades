import { useCallback, useEffect } from "react";
import { loadContact } from "./rememberedContact";

// 308: la ficha trae varios formularios (visita, contacto, alerta) que piden nombre, teléfono y correo. Lo que la persona ya
// escribió en uno se copia a los campos VACÍOS de los demás en la misma página, para no teclearlo dos o tres veces.
// Solo vive en memoria mientras la página está abierta: no se guarda en el navegador hasta que se envía un formulario
// (eso sigue haciéndolo rememberedContact.js), así que un formulario a medias nunca deja datos personales guardados.
const FIELDS = ["name", "email", "phone"];
const EVENT = "acl:shared-contact";
let live = {};

// Para pruebas: vuelve a empezar sin nada compartido.
export function resetSharedContact() {
  live = {};
}

export function shareContact(values) {
  let changed = false;
  for (const field of FIELDS) {
    const value = String(values?.[field] ?? "").trim();
    if (value && live[field] !== value) {
      live[field] = value.slice(0, 200);
      changed = true;
    }
  }
  if (changed && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT));
}

export function currentSharedContact() {
  return { ...loadContact(), ...live };
}

// Completa solo los campos de `form` que están vacíos y que ese formulario tiene; si no hay nada que completar devuelve el
// mismo objeto (así React no vuelve a pintar).
export function fillBlanks(form, source = currentSharedContact()) {
  let next = form;
  for (const field of FIELDS) {
    if (field in form && !String(form[field] ?? "").trim() && source[field]) {
      if (next === form) next = { ...form };
      next[field] = source[field];
    }
  }
  return next;
}

// Para un formulario: devuelve la función que comparte lo escrito (llamarla al salir de un campo) y se suscribe a lo que
// escriben los demás formularios para llenar los campos vacíos propios.
export function useSharedContact(setForm) {
  useEffect(() => {
    const onShared = () => setForm((prev) => fillBlanks(prev));
    window.addEventListener(EVENT, onShared);
    return () => window.removeEventListener(EVENT, onShared);
  }, [setForm]);
  return useCallback((form) => shareContact(form), []);
}

// 388: recordar nombre, correo y teléfono de quien ya mandó un formulario del sitio, para no volver a escribirlos.
// Solo vive en el navegador de esa persona (localStorage); nunca sale a ningún servidor por esta vía.
const KEY = "acl_remembered_contact";
const FIELDS = ["name", "email", "phone"];

export function loadContact(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const raw = JSON.parse(storage?.getItem(KEY) || "{}");
    const out = {};
    for (const field of FIELDS) if (typeof raw?.[field] === "string") out[field] = raw[field].slice(0, 200);
    return out;
  } catch {
    return {};
  }
}

export function saveContact(values, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    const next = { ...loadContact(storage) };
    for (const field of FIELDS) {
      const value = String(values?.[field] ?? "").trim();
      if (value) next[field] = value.slice(0, 200);
    }
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): simplemente no se recuerda.
  }
}

export function forgetContact(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    storage?.removeItem(KEY);
  } catch {
    // nada que hacer
  }
}

// Formulario vacío con lo recordado ya puesto (solo en los campos que ese formulario tiene).
export function withRemembered(emptyForm, remembered = loadContact()) {
  const form = { ...emptyForm };
  for (const field of FIELDS) if (field in emptyForm && !form[field] && remembered[field]) form[field] = remembered[field];
  return form;
}

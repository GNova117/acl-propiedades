// Centro de ayuda y recorrido guiado del panel. Qué temas y pasos le tocan a cada quien depende de los apartados de su
// rol (los mismos que muestran el menú); el texto vive en i18n (help.topics.<clave> y help.tour.<clave>). Funciones puras.

// `sections`: con tener CUALQUIERA de estos apartados se muestra (null = todos); `to`: a dónde lleva «Ir allí».
export const HELP_TOPICS = [
  { key: "myDay", sections: ["agenda", "prospectos"], to: "/admin/mi-dia" },
  { key: "prospects", sections: ["prospectos"], to: "/admin/prospectos" },
  { key: "agenda", sections: ["agenda"], to: "/admin/agenda" },
  { key: "properties", sections: ["propiedades"], to: "/admin/propiedades" },
  { key: "visits", sections: ["visitas"], to: "/admin/visitas" },
  { key: "commissions", sections: ["liquidaciones"], to: "/admin/comisiones" },
  { key: "roles", sections: ["roles"], to: "/admin/roles" },
  { key: "shortcuts", sections: null, to: null },
  { key: "account", sections: null, to: null },
];

// Pasos del recorrido: una bienvenida, los temas principales a los que tiene acceso y el cierre (dónde está la ayuda).
export const TOUR_TOPICS = ["myDay", "prospects", "agenda", "properties"];

export const canSee = (topic, hasSection) => !topic.sections || topic.sections.some((s) => hasSection(s));

export const visibleTopics = (hasSection) => HELP_TOPICS.filter((t) => canSee(t, hasSection));

export const tourSteps = (hasSection) => ["welcome", ...HELP_TOPICS.filter((t) => TOUR_TOPICS.includes(t.key) && canSee(t, hasSection)).map((t) => t.key), "help"];

// Búsqueda en la ayuda: `text(topic)` → el texto de ese tema (título + cuerpo) ya traducido. Sin acentos ni mayúsculas.
const fold = (value) => String(value ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function searchTopics(topics, query, text) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return topics;
  return topics.filter((topic) => {
    const haystack = fold(text(topic));
    return words.every((w) => haystack.includes(w));
  });
}

// El recorrido se muestra solo la primera vez, por persona y por dispositivo.
const seenKey = (email) => `acl.tourSeen.${String(email || "anon").toLowerCase()}`;

export function isTourSeen(email, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    return storage?.getItem(seenKey(email)) === "1";
  } catch {
    return true; // sin almacenamiento no se puede recordar: mejor no insistir en cada visita.
  }
}

export function markTourSeen(email, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    storage?.setItem(seenKey(email), "1");
  } catch {
    // nada: se volverá a ofrecer, no pasa nada.
  }
}

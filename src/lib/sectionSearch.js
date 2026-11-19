// Búsqueda de apartados del panel (botón de la lupa en la barra superior): la persona escribe una palabra
// ("crédito", "gastos", "firma"…) y salen todas las pantallas que tengan que ver, aunque la palabra no esté en el
// nombre del apartado. Funciones puras: el componente (AdminSectionSearch) solo las pinta.

// Palabras que describen cada pantalla además de su nombre (español e inglés, sin acentos: se comparan plegadas).
export const KEYWORDS = {
  "/admin": "inicio resumen panel principal dashboard home indicadores metricas",
  "/admin/panel": "inicio resumen panel principal dashboard home indicadores metricas",
  "/admin/mi-dia": "hoy pendientes tareas agenda dia today to-do",
  "/admin/mi-perfil": "perfil cuenta datos personales foto asesor profile account",
  "/admin/propiedades": "casas departamentos terrenos inmuebles venta renta catalogo publicar fotos precio listings houses",
  "/admin/desarrollos": "torres proyectos preventa departamentos edificios developments",
  "/admin/naves-industriales": "bodegas industrial naves parque warehouse",
  "/admin/zonas": "colonias municipios ciudades mapa precios por zona neighborhoods",
  "/admin/asesores": "agentes vendedores equipo personal advisors agents team",
  "/admin/clientes": "compradores vendedores contactos expediente documentos telefono correo clients buyers",
  "/admin/prospectos": "leads interesados embudo seguimiento contacto whatsapp llamada prospects",
  "/admin/equipo": "equipo hoy asesores actividad del dia team",
  "/admin/estadisticas": "embudo conversion graficas funnel statistics cifras",
  "/admin/alertas": "avisos alertas de propiedades suscripciones correo whatsapp alerts",
  "/admin/mensajes": "contacto formulario solicitudes bandeja correo inbox messages",
  "/admin/testimonios": "opiniones resenas reviews comentarios clientes",
  "/admin/blog": "articulos noticias publicaciones entradas posts",
  "/admin/visitas": "citas visitas a propiedades informe encuesta recorrido",
  "/admin/gastos": "desglose gastos escrituracion notario impuestos isai avaluo comisiones tarifas costos municipio comprador vendedor expenses closing costs",
  "/admin/gastos/historial": "gastos desglose guardados casa registros historial anteriores expenses history",
  "/admin/valuacion": "avaluo estimacion de valor precio de mercado comparables cuanto vale valuation appraisal",
  "/admin/solicitud-avaluo": "avaluo formato solicitud pdf unidad de valuacion credito infonavit appraisal request",
  "/admin/inspecciones": "revision inspeccion estado de la casa checklist fotos danos inspection",
  "/admin/credito-infonavit": "credito infonavit simulador hipotecario hipoteca mensualidad enganche subcuenta vivienda precalificacion cofinavit mortgage loan",
  "/admin/solicitud-credito": "credito infonavit formato solicitud pdf hipotecario tramite loan application",
  "/admin/documentos-legales": "contratos legales promesa compraventa mandato exclusiva formatos documents contracts",
  "/admin/plantillas-documentos": "plantillas contratos formatos modelos documentos templates",
  "/admin/firmas": "firma electronica firmar contratos enlace pendientes por firmar signatures sign",
  "/admin/remodelaciones": "obra remodelar mejoras presupuesto avance proyectos renovation remodel",
  "/admin/materiales": "catalogo materiales precios proveedores insumos construccion materials",
  "/admin/construccion": "obra construir planos proyecto presupuesto avance construction build",
  "/admin/agenda": "calendario citas reuniones recordatorios eventos agenda calendar",
  "/admin/secretaria": "llaves entrega recepcion documentos oficina registro keys office",
  "/admin/reportes": "ventas reportes comisiones cierres ingresos informes sales reports",
  "/admin/reporte-mensual": "mes mensual resumen reporte ventas cierres monthly report",
  "/admin/comisiones": "utilidad liquidacion pagos comisiones ganancias asesores commissions payouts",
  "/admin/actividad": "bitacora quien cambio historial registro de cambios auditoria activity log audit",
  "/admin/errores": "fallas problemas errores del sitio monitoreo bugs errors",
  "/admin/novedades": "noticias novedades avisos anuncios cambios del sistema news updates",
  "/admin/roles": "permisos accesos usuarios roles seguridad quien ve que permissions access",
  "/admin/seguridad": "contrasena verificacion dos pasos mfa dispositivos sesion password security 2fa",
  "/admin/ayuda": "ayuda soporte guia tutorial como se usa recorrido preguntas help support guide faq",
};

// Pantallas que no están en el menú pero sí se buscan: alta de algo nuevo y subpantallas. `labelKey` vive en i18n
// (sectionSearch.extra.*); `groupKey` es la carpeta del menú a la que pertenecen (para el rótulo del resultado).
export const EXTRA_DESTINATIONS = [
  { section: "gastos", to: "/admin/gastos/historial", labelKey: "sectionSearch.extra.expenseHistory", groupKey: "herramientas" },
  { section: "propiedades", to: "/admin/propiedades/nueva", labelKey: "sectionSearch.extra.newProperty", groupKey: "propiedades" },
  { section: "clientes", to: "/admin/clientes/nuevo", labelKey: "sectionSearch.extra.newClient", groupKey: "clientes" },
  { section: "prospectos", to: "/admin/prospectos/nuevo", labelKey: "sectionSearch.extra.newProspect", groupKey: "clientes" },
  { section: "visitas", to: "/admin/visitas/nueva", labelKey: "sectionSearch.extra.newVisit", groupKey: "clientes" },
  { section: "agenda", to: "/admin/agenda/nueva", labelKey: "sectionSearch.extra.newAppointment", groupKey: "oficina" },
];

const EXTRA_KEYWORDS = {
  "/admin/propiedades/nueva": "agregar nueva propiedad capturar publicar alta casa departamento terreno add new property",
  "/admin/clientes/nuevo": "agregar nuevo cliente alta registrar comprador vendedor add new client",
  "/admin/prospectos/nuevo": "agregar nuevo prospecto lead alta registrar interesado add new prospect",
  "/admin/visitas/nueva": "agregar registrar nueva visita cita a propiedad add new visit",
  "/admin/agenda/nueva": "agregar nueva cita evento recordatorio reunion add new appointment",
};

export const fold = (value) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Todos los destinos que esta persona puede abrir, con su carpeta. `hasSection(clave)` y `advisorId` son los mismos
// que usa el menú: lo que no ve en el menú tampoco aparece aquí.
export function accessibleDestinations(nav, hasSection, advisorId = null) {
  const out = [];
  const seen = new Set();
  const add = (item, groupKey) => {
    if (seen.has(item.to)) return;
    seen.add(item.to);
    out.push({ to: item.to, label: item.label, labelKey: item.labelKey, groupKey: groupKey ?? null });
  };
  for (const entry of nav) {
    if (entry.items) {
      for (const item of entry.items) {
        if (hasSection(item.section) && (!item.officeOnly || advisorId == null)) add(item, entry.key);
      }
    } else if (entry.requiresAdvisor) {
      if (advisorId != null) add(entry, null);
    } else if (entry.anySection) {
      if (entry.anySection.some(hasSection)) add(entry, null);
    } else if (entry.section === null || hasSection(entry.section)) {
      add(entry, null);
    }
  }
  for (const extra of EXTRA_DESTINATIONS) {
    if (hasSection(extra.section)) add(extra, extra.groupKey);
  }
  return out;
}

// Una palabra de la búsqueda coincide con un texto si aparece tal cual o, para plurales, sin su "s"/"es" final
// ("créditos" encuentra "credito").
const wordMatches = (haystack, word) => {
  if (haystack.includes(word)) return true;
  if (word.length > 3 && word.endsWith("es") && haystack.includes(word.slice(0, -2))) return true;
  if (word.length > 3 && word.endsWith("s") && haystack.includes(word.slice(0, -1))) return true;
  return false;
};

// Busca `query` entre los destinos. `labelOf(dest)` devuelve el nombre ya traducido y `groupLabelOf(dest)` el de la carpeta.
// Cada palabra de la búsqueda debe aparecer en el nombre, la carpeta o las palabras clave. Primero salen los que
// la tienen en el nombre (y mejor aún al principio), después los que solo la tienen en las palabras clave.
export function searchDestinations(destinations, query, labelOf, groupLabelOf = () => "") {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored = [];
  destinations.forEach((dest, order) => {
    const label = fold(labelOf(dest));
    const group = fold(groupLabelOf(dest));
    const keywords = fold(`${KEYWORDS[dest.to] ?? ""} ${EXTRA_KEYWORDS[dest.to] ?? ""}`);
    let score = 0;
    for (const word of words) {
      if (label.split(/[\s/·-]+/).some((w) => w.startsWith(word))) score += 3;
      else if (wordMatches(label, word)) score += 2;
      else if (wordMatches(keywords, word)) score += 1;
      else if (wordMatches(group, word)) score += 0.5;
      else return;
    }
    scored.push({ dest, score, order });
  });
  return scored.sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.dest);
}

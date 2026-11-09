// Pantalla de inicio del panel y barra de abajo en el teléfono. Funciones
// puras + lectura/escritura de la preferencia (localStorage, por
// dispositivo: el asesor que usa la computadora de la oficina para
// reportes y el teléfono en la calle puede tener un inicio distinto en
// cada uno).

export const HOME_PREF_KEY = "acl_admin_home";
export const HOME_MY_DAY = "mi-dia";
export const HOME_PANEL = "panel";
export const HOME_CHANGE_EVENT = "acl-admin-home-change";

// "Mi día" se muestra con la agenda o con prospectos (ver AdminLayout NAV).
export const canUseMyDay = (hasSection) => hasSection("agenda") || hasSection("prospectos");

// Con qué pantalla se abre /admin. Si la persona ya eligió, se respeta;
// si no, un login ligado a un asesor (advisorId) arranca en "Mi día" — es
// lo que un asesor necesita al abrir el panel en la mañana — y la oficina
// (sin asesor) en el Panel principal de siempre.
export function resolveAdminHome({ stored, advisorId, canMyDay }) {
  if (!canMyDay) return HOME_PANEL;
  if (stored === HOME_MY_DAY || stored === HOME_PANEL) return stored;
  return advisorId != null ? HOME_MY_DAY : HOME_PANEL;
}

export function readHomePref() {
  try {
    return localStorage.getItem(HOME_PREF_KEY);
  } catch {
    return null;
  }
}

export function writeHomePref(value) {
  try {
    localStorage.setItem(HOME_PREF_KEY, value);
  } catch {
    /* sin almacenamiento: se queda el inicio por omisión */
  }
  window.dispatchEvent(new Event(HOME_CHANGE_EVENT));
}

// Barra de abajo en el teléfono: lo del día a día a un toque, en este orden
// y solo lo que el rol tiene; el resto del menú queda tras «Más». Si el rol
// tiene pocas de estas, se completa con otras de uso frecuente.
const TAB_CANDIDATES = [
  { key: "myDay", to: "/admin/mi-dia", icon: "☀", labelKey: "admin.myDay", visible: ({ canMyDay }) => canMyDay },
  { key: "prospects", to: "/admin/prospectos", icon: "◎", labelKey: "adminTabs.prospects", section: "prospectos" },
  { key: "agenda", to: "/admin/agenda", icon: "▦", labelKey: "adminTabs.agenda", section: "agenda" },
  { key: "clients", to: "/admin/clientes", icon: "☺", labelKey: "adminTabs.clients", section: "clientes" },
  { key: "properties", to: "/admin/propiedades", icon: "⌂", labelKey: "adminTabs.properties", section: "propiedades" },
  { key: "messages", to: "/admin/mensajes", icon: "✉", labelKey: "adminTabs.messages", section: "mensajes" },
];
export const MAX_TABS = 4;

export function mobileTabs({ hasSection, home }) {
  const canMyDay = canUseMyDay(hasSection);
  const tabs = TAB_CANDIDATES.filter((tab) => (tab.visible ? tab.visible({ canMyDay }) : hasSection(tab.section))).slice(0, MAX_TABS);
  // El inicio siempre tiene su pestaña: si es el Panel principal, va primero.
  if (home === HOME_PANEL) {
    const panel = { key: "home", to: "/admin", end: true, icon: "⌂", labelKey: "adminTabs.home" };
    return [panel, ...tabs.filter((tab) => tab.key !== "myDay")].slice(0, MAX_TABS);
  }
  return tabs;
}

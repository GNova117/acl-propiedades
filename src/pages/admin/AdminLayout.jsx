import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import LanguageToggle from "../../components/LanguageToggle";
import ErrorBoundary from "../../components/ErrorBoundary";
import AdminGlobalSearch from "../../components/AdminGlobalSearch";
import InstallAppButton from "../../components/InstallAppButton";
import NotificationBell from "../../components/NotificationBell";
import QuickCapture from "../../components/QuickCapture";
import OfflineBanner from "../../components/OfflineBanner";
import IdleLogout from "../../components/IdleLogout";
import MfaNudge from "../../components/MfaNudge";
import TourBanner from "../../components/TourBanner";
import NavIcon from "../../components/NavIcon";
import { ICON_BY_GROUP, ICON_BY_PATH } from "../../lib/navIcons";
import { itemForPath, loadPins, loadRecents, pushRecent, resolveShortcuts, savePins, saveRecents, togglePin } from "../../lib/navShortcuts";
import { getQueue } from "../../lib/offlineQueue";
import { startPrecache } from "../../lib/offlineShell";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/dataStore";
import { liveBus, startLiveUpdates, useLiveRefresh } from "../../lib/liveUpdates";
import { queries } from "../../lib/queries";
import { revalidate } from "../../lib/dataCache";
import { deviceLabel, getDeviceId } from "../../lib/deviceInfo";
import { HOME_MY_DAY, mobileTabs } from "../../lib/adminHome";
import { useAdminHome } from "../../lib/useAdminHome";
import "./AdminLayout.css";
import { confirmDialog, notify } from "../../lib/toast";

// Menú por carpetas. Cada item se muestra solo si el rol tiene ese apartado;
// una carpeta sin ningún item visible no se dibuja. Los apartados sueltos
// (sin carpeta) van como { section, to, label } directo en la lista.
const NAV = [
  { section: null, to: "/admin", end: true, labelKey: "admin.dashboard" },
  // Lo de hoy en un solo lugar: se muestra con la agenda o con prospectos.
  { section: null, anySection: ["agenda", "prospectos"], to: "/admin/mi-dia", labelKey: "admin.myDay" },
  // Sin apartado: se muestra por tener un login vinculado a un asesor
  // (advisorId), no por un permiso de rol — ver AdminMyProfile.jsx.
  { section: null, to: "/admin/mi-perfil", labelKey: "admin.myProfile", requiresAdvisor: true },
  {
    key: "propiedades",
    labelKey: "admin.groups.propiedades",
    items: [
      { section: "propiedades", to: "/admin/propiedades", labelKey: "admin.properties" },
      { section: "propiedades", to: "/admin/desarrollos", labelKey: "developments.admin.navTitle" },
      { section: "naves_industriales", to: "/admin/naves-industriales", labelKey: "admin.industrialWarehouses" },
      { section: "zonas", to: "/admin/zonas", labelKey: "admin.zones" },
      { section: "asesores", to: "/admin/asesores", labelKey: "admin.advisors" },
    ],
  },
  {
    key: "clientes",
    labelKey: "admin.groups.clientes",
    items: [
      { section: "clientes", to: "/admin/clientes", labelKey: "admin.clients" },
      { section: "prospectos", to: "/admin/prospectos", labelKey: "accessControl.sections.prospectos" },
      { section: "prospectos", to: "/admin/equipo", labelKey: "team.navTitle", officeOnly: true },
      { section: "prospectos", to: "/admin/estadisticas", labelKey: "funnel.title" },
      { section: "prospectos", to: "/admin/alertas", labelKey: "alerts.admin.title" },
      { section: "mensajes", to: "/admin/mensajes", labelKey: "admin.messages", badge: true },
      { section: "testimonios", to: "/admin/testimonios", labelKey: "admin.testimonials" },
      { section: "blog", to: "/admin/blog", labelKey: "blog.admin.title" },
      { section: "visitas", to: "/admin/visitas", labelKey: "accessControl.sections.visitas" },
    ],
  },
  {
    key: "herramientas",
    labelKey: "admin.groups.herramientas",
    items: [
      { section: "gastos", to: "/admin/gastos", labelKey: "accessControl.sections.gastos" },
      { section: "valuacion", to: "/admin/valuacion", labelKey: "accessControl.sections.valuacion" },
      { section: "valuacion", to: "/admin/solicitud-avaluo", labelKey: "solicitudAvaluo.navTitle" },
      { section: "inspecciones", to: "/admin/inspecciones", labelKey: "accessControl.sections.inspecciones" },
      { section: "credito_infonavit", to: "/admin/credito-infonavit", labelKey: "admin.infonavitSimulator" },
      { section: "credito_infonavit", to: "/admin/solicitud-credito", labelKey: "solicitudCredito.navTitle" },
      { section: "documentos_legales", to: "/admin/documentos-legales", labelKey: "accessControl.sections.documentos_legales" },
      { section: "documentos_legales", to: "/admin/plantillas-documentos", labelKey: "documentTemplates.title" },
      { section: "documentos_legales", to: "/admin/firmas", labelKey: "signing.admin.title" },
    ],
  },
  {
    key: "obra",
    labelKey: "admin.groups.obra",
    items: [
      { section: "remodelaciones", to: "/admin/remodelaciones", labelKey: "admin.remodelProjects" },
      { section: "materiales", to: "/admin/materiales", labelKey: "materialsCatalog.title" },
      { section: "construccion", to: "/admin/construccion", label: "Construcción" },
    ],
  },
  {
    key: "oficina",
    labelKey: "admin.groups.oficina",
    items: [
      { section: "agenda", to: "/admin/agenda", labelKey: "accessControl.sections.agenda" },
      { section: "secretaria", to: "/admin/secretaria", labelKey: "accessControl.sections.secretaria" },
      { section: "reportes", to: "/admin/reportes", labelKey: "accessControl.sections.reportes" },
      { section: "reportes", to: "/admin/reporte-mensual", labelKey: "monthly.title" },
      { section: "liquidaciones", to: "/admin/comisiones", labelKey: "commissions.navTitle" },
      { section: "roles", to: "/admin/actividad", labelKey: "activity.title" },
      { section: "roles", to: "/admin/errores", labelKey: "errors.navTitle" },
      { section: "novedades", to: "/admin/novedades", labelKey: "novedades.admin.title" },
    ],
  },
  { section: "roles", to: "/admin/roles", labelKey: "accessControl.sections.roles" },
  { section: null, to: "/admin/seguridad", labelKey: "security.navTitle" },
  { section: null, to: "/admin/ayuda", labelKey: "help.navTitle" },
];

const OPEN_KEY = "acl_admin_nav_open";
const COMPACT_KEY = "acl_admin_nav_compact";
const readOpen = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(OPEN_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};
const isInside = (pathname, to) => pathname === to || pathname.startsWith(`${to}/`);

export default function AdminLayout() {
  const { t } = useTranslation();
  const { logout, hasSection, advisorId, session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [openGroups, setOpenGroups] = useState(readOpen);
  // Atajos del menú (ver lib/navShortcuts.js): lo fijado arriba, lo visitado hace poco y el modo compacto (solo iconos).
  const email = session?.user?.email;
  const [pins, setPins] = useState(() => loadPins(email));
  const [recents, setRecents] = useState(() => loadRecents(email));
  const [compact, setCompact] = useState(() => {
    try {
      return localStorage.getItem(COMPACT_KEY) === "1";
    } catch {
      return false;
    }
  });
  // En pantallas chicas el menú es un cajón que se abre con el botón ☰.
  const [menuOpen, setMenuOpen] = useState(false);
  const { home } = useAdminHome();
  const myDayIsHome = home === HOME_MY_DAY;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Con señal, el panel se guarda en el dispositivo para que abra aunque se recargue sin conexión (lib/offlineShell.js).
  useEffect(() => startPrecache(), []);

  // Registra este dispositivo en «Seguridad → dispositivos» (como mucho una vez cada 6 horas por navegador).
  useEffect(() => {
    if (!email) return;
    try {
      const key = "acl_device_touched";
      const last = Number(localStorage.getItem(key)) || 0;
      if (Date.now() - last < 6 * 3600_000) return;
      db.touchDevice(getDeviceId(), deviceLabel())
        .then(() => localStorage.setItem(key, String(Date.now())))
        .catch(() => {});
    } catch {
      /* sin almacenamiento: no se registra */
    }
  }, [email]);

  // Cierre por inactividad (lib/idleSession.js): no se cierra con capturas sin enviar guardadas en el dispositivo.
  const expireIdle = async () => {
    await logout();
    navigate("/admin/login", { replace: true, state: { idle: true } });
  };

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.classList.add("admin-menu-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("admin-menu-open");
    };
  }, [menuOpen]);

  // Con "Mi día" como inicio, va primero y el Panel principal se mueve a
  // /admin/panel (/admin redirige a Mi día, ver AdminHome.jsx).
  const nav = myDayIsHome
    ? [
        NAV[1],
        { ...NAV[0], to: "/admin/panel" },
        ...NAV.slice(2),
      ]
    : NAV;

  const visibleNav = nav.map((entry) =>
    entry.items ? { ...entry, items: entry.items.filter((item) => hasSection(item.section) && (!item.officeOnly || advisorId == null)) } : entry
  ).filter((entry) => {
    if (entry.items) return entry.items.length > 0;
    if (entry.requiresAdvisor) return advisorId != null;
    if (entry.anySection) return entry.anySection.some(hasSection);
    return entry.section === null || hasSection(entry.section);
  });

  // Todos los elementos que la persona puede usar, en el orden del menú (para fijados y recientes).
  const allItems = visibleNav.flatMap((entry) => (entry.items ? entry.items : [entry]));
  const itemPaths = allItems.map((i) => i.to);
  const pinnedSet = new Set(pins.filter((to) => itemPaths.includes(to)));
  // Un elemento fijado se mueve arriba: ya no se repite en su carpeta (ni como enlace suelto).
  const navWithoutPinned = visibleNav
    .map((entry) => (entry.items ? { ...entry, items: entry.items.filter((i) => !pinnedSet.has(i.to)) } : entry))
    .filter((entry) => (entry.items ? entry.items.length > 0 : !pinnedSet.has(entry.to)));

  const togglePinned = (to) => {
    setPins((prev) => {
      const next = togglePin(prev, to);
      savePins(email, next);
      return next;
    });
  };

  // La página visitada pasa a «recientes».
  useEffect(() => {
    const to = itemForPath(pathname, itemPaths);
    if (!to) return;
    setRecents((prev) => {
      const next = pushRecent(prev, to);
      if (next.join("|") === prev.join("|")) return prev;
      saveRecents(email, next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleCompact = () => {
    setCompact((prev) => {
      try {
        localStorage.setItem(COMPACT_KEY, prev ? "0" : "1");
      } catch {
        /* sin almacenamiento: vale mientras la pantalla siga abierta */
      }
      return !prev;
    });
  };

  // La carpeta de la página actual siempre se abre, aunque el usuario la
  // hubiera cerrado antes (así nunca se "pierde" dónde está).
  useEffect(() => {
    const current = visibleNav.find((g) => g.items?.some((item) => isInside(pathname, item.to)));
    if (current) setOpenGroups((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleGroup = (key) => {
    setOpenGroups((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(OPEN_KEY, JSON.stringify(next));
      } catch {
        /* sin almacenamiento: el menú funciona igual */
      }
      return next;
    });
  };

  const iconFor = (item) => ICON_BY_PATH[item.to] || "dashboard";
  const labelOf = (item) => item.label || t(item.labelKey);

  const renderLink = (item) => (
    // onClick además del cierre por cambio de ruta: tocar el enlace de la
    // página donde ya estás no cambia la ruta y el cajón se quedaba abierto.
    <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)} title={compact ? labelOf(item) : undefined} id={`nav-link-${item.to.replace(/\W+/g, "-")}`}>
      <NavIcon name={iconFor(item)} />
      <span className="admin-layout__nav-label">{labelOf(item)}</span>
      {item.badge && newMessagesCount > 0 && <span className="admin-layout__nav-badge">{newMessagesCount}</span>}
    </NavLink>
  );

  // Un enlace con su estrella para fijarlo (o quitarlo de fijados). La estrella es un botón APARTE del enlace (un botón
  // dentro de un enlace no es válido) y su nombre no repite el del apartado: lo describe `aria-describedby`.
  const renderRow = (item, isPinned) => (
    <div key={item.to} className={`admin-layout__nav-row${isPinned ? " is-pinned" : ""}`}>
      {renderLink(item)}
      <button
        type="button"
        className="admin-layout__pin"
        aria-pressed={isPinned}
        aria-label={isPinned ? t("adminNav.unpin") : t("adminNav.pin")}
        aria-describedby={`nav-link-${item.to.replace(/\W+/g, "-")}`}
        title={isPinned ? t("adminNav.unpin") : t("adminNav.pin")}
        onClick={() => togglePinned(item.to)}
      >
        <NavIcon name="pin" />
      </button>
    </div>
  );

  // Tiempo real (lib/liveUpdates.js): un solo canal mientras el panel está abierto. Los mensajes y prospectos nuevos llegan
  // solos; antes el contador bajaba TODOS los mensajes en cada cambio de pantalla.
  useEffect(() => startLiveUpdates(db), []);

  // El contador del menú pide solo el número: al abrir, cuando llega un cambio y al volver a la pestaña (por si el canal se
  // cortó mientras estaba en segundo plano).
  const liveMessages = useLiveRefresh(["contact_messages"], { delayMs: 500 });
  useEffect(() => {
    if (!hasSection("mensajes")) return undefined;
    const refresh = () => db.countNewContactMessages().then(setNewMessagesCount).catch(() => {});
    refresh();
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMessages]);

  // La lista de prospectos que comparten las pantallas se actualiza sola cuando entra o cambia uno.
  const liveProspects = useLiveRefresh(["prospectos"], { delayMs: 800 });
  useEffect(() => {
    if (liveProspects > 0 && hasSection("prospectos")) revalidate(queries.prospects.key, queries.prospects.fetch, { force: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveProspects]);

  // Aviso discreto cuando llega algo nuevo de verdad (solo con Supabase: el modo demo no distingue altas de cambios).
  useEffect(() => {
    const stops = [
      liveBus.subscribe(["contact_messages"], (e) => e.type === "INSERT" && hasSection("mensajes") && notify(t("live.newMessage", { name: e.record?.name || "" }))),
      liveBus.subscribe(["prospectos"], (e) => e.type === "INSERT" && hasSection("prospectos") && notify(t("live.newProspect", { name: e.record?.name || "" }))),
    ];
    return () => stops.forEach((stop) => stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // Los recientes solo salen si NO se ven ya en el menú (una carpeta cerrada los esconde); así no se repite ningún enlace.
  const visiblePaths = new Set([...navWithoutPinned.filter((e) => !e.items).map((e) => e.to), ...navWithoutPinned.filter((e) => e.items && openGroups.includes(e.key)).flatMap((e) => e.items.map((i) => i.to))]);
  const shortcuts = resolveShortcuts(allItems, [...pinnedSet], recents, visiblePaths);

  const handleLogout = async () => {
    // Lo que se capturó sin señal y aún no se envía se queda en este dispositivo: se avisa antes de salir.
    const waiting = getQueue(session?.user?.email).length;
    if (waiting > 0 && !await confirmDialog(t("offline.logoutConfirm", { count: waiting }))) return;
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className={`admin-layout${compact ? " is-compact" : ""}`}>
      <aside id="admin-sidebar" className={`admin-layout__sidebar${menuOpen ? " is-open" : ""}`}>
        <NavLink to="/" className="admin-layout__logo">
          <Logo variant="white" size="sm" />
        </NavLink>
        <nav>
          {shortcuts.pinned.length > 0 && (
            <div className="admin-layout__shortcuts" role="group" aria-label={t("adminNav.pinned")}>
              <div className="admin-layout__shortcuts-title">{t("adminNav.pinned")}</div>
              {shortcuts.pinned.map((item) => renderRow(item, true))}
            </div>
          )}
          {shortcuts.recent.length > 0 && (
            <div className="admin-layout__shortcuts" role="group" aria-label={t("adminNav.recent")}>
              <div className="admin-layout__shortcuts-title">{t("adminNav.recent")}</div>
              {shortcuts.recent.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="admin-layout__recent" onClick={() => setMenuOpen(false)} title={compact ? labelOf(item) : undefined}>
                  <NavIcon name={iconFor(item)} />
                  <span className="admin-layout__nav-label">{labelOf(item)}</span>
                </NavLink>
              ))}
            </div>
          )}
          {navWithoutPinned.map((entry) => {
            if (!entry.items) return renderRow(entry, false);
            const open = openGroups.includes(entry.key);
            const hasBadge = !open && newMessagesCount > 0 && entry.items.some((i) => i.badge);
            return (
              <div key={entry.key} className="admin-layout__group">
                <button
                  type="button"
                  className="admin-layout__group-toggle"
                  aria-expanded={open}
                  onClick={() => toggleGroup(entry.key)}
                  title={compact ? t(entry.labelKey) : undefined}
                >
                  <NavIcon name={ICON_BY_GROUP[entry.key] || "dashboard"} />
                  <span className="admin-layout__nav-label">{t(entry.labelKey)}</span>
                  {hasBadge && <span className="admin-layout__nav-badge">{newMessagesCount}</span>}
                  <span className={`admin-layout__chevron${open ? " is-open" : ""}`} aria-hidden="true">›</span>
                </button>
                {open && <div className="admin-layout__group-items">{entry.items.map((item) => renderRow(item, false))}</div>}
              </div>
            );
          })}
        </nav>
        <button type="button" className="admin-layout__compact-toggle" aria-pressed={compact} onClick={toggleCompact} title={compact ? t("adminNav.expand") : t("adminNav.compact")}>
          <span aria-hidden="true">{compact ? "»" : "«"}</span>
          <span className="admin-layout__nav-label">{compact ? t("adminNav.expand") : t("adminNav.compact")}</span>
        </button>
        <button type="button" className="admin-layout__logout" onClick={handleLogout} title={compact ? t("admin.logout") : undefined}>
          <span className="admin-layout__logout-icon" aria-hidden="true">⏻</span>
          <span className="admin-layout__nav-label">{t("admin.logout")}</span>
        </button>
      </aside>

      {menuOpen && <div className="admin-layout__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="admin-layout__main">
        <header className="admin-layout__topbar">
          <button
            type="button"
            className="admin-layout__menu-btn"
            aria-label={t("admin.menu")}
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span aria-hidden="true" />
          </button>
          <AdminGlobalSearch />
          <div className="admin-layout__topbar-actions">
            <NotificationBell />
            <InstallAppButton />
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </header>
        <main className="admin-layout__content">
          <OfflineBanner />
          <TourBanner />
          <MfaNudge />
          <ErrorBoundary key={pathname} homePath="/admin">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <IdleLogout onExpire={expireIdle} canExpire={() => getQueue().length === 0} />
      {/* Teléfono: lo del día a día a un toque; «Más» abre el menú completo. */}
      <nav className="admin-tabbar" aria-label={t("adminTabs.label")}>
        {mobileTabs({ hasSection, home }).map((tab) => (
          <NavLink key={tab.key} to={tab.to} end={tab.end} className="admin-tabbar__item">
            <span className="admin-tabbar__icon" aria-hidden="true">{tab.icon}</span>
            <span className="admin-tabbar__label">{t(tab.labelKey)}</span>
          </NavLink>
        ))}
        <button
          type="button"
          className={`admin-tabbar__item admin-tabbar__more${menuOpen ? " active" : ""}`}
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="admin-tabbar__icon" aria-hidden="true">☰</span>
          <span className="admin-tabbar__label">{t("adminTabs.more")}</span>
          {newMessagesCount > 0 && <span className="admin-layout__nav-badge admin-tabbar__badge">{newMessagesCount}</span>}
        </button>
      </nav>
      <QuickCapture />
    </div>
  );
}

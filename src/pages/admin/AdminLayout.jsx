import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import LanguageToggle from "../../components/LanguageToggle";
import ErrorBoundary from "../../components/ErrorBoundary";
import AdminGlobalSearch from "../../components/AdminGlobalSearch";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/dataStore";
import "./AdminLayout.css";

// Menú por carpetas. Cada item se muestra solo si el rol tiene ese apartado;
// una carpeta sin ningún item visible no se dibuja. Los apartados sueltos
// (sin carpeta) van como { section, to, label } directo en la lista.
const NAV = [
  { section: null, to: "/admin", end: true, labelKey: "admin.dashboard" },
  {
    key: "propiedades",
    labelKey: "admin.groups.propiedades",
    items: [
      { section: "propiedades", to: "/admin/propiedades", labelKey: "admin.properties" },
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
      { section: "prospectos", to: "/admin/estadisticas", labelKey: "funnel.title" },
      { section: "mensajes", to: "/admin/mensajes", labelKey: "admin.messages", badge: true },
      { section: "testimonios", to: "/admin/testimonios", labelKey: "admin.testimonials" },
      { section: "visitas", to: "/admin/visitas", labelKey: "accessControl.sections.visitas" },
    ],
  },
  {
    key: "herramientas",
    labelKey: "admin.groups.herramientas",
    items: [
      { section: "valuacion", to: "/admin/valuacion", labelKey: "accessControl.sections.valuacion" },
      { section: "credito_infonavit", to: "/admin/credito-infonavit", labelKey: "admin.infonavitSimulator" },
      { section: "documentos_legales", to: "/admin/documentos-legales", labelKey: "accessControl.sections.documentos_legales" },
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
      { section: "roles", to: "/admin/actividad", labelKey: "activity.title" },
    ],
  },
  { section: "roles", to: "/admin/roles", labelKey: "accessControl.sections.roles" },
];

const OPEN_KEY = "acl_admin_nav_open";
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
  const { logout, hasSection } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [openGroups, setOpenGroups] = useState(readOpen);
  // En pantallas chicas el menú es un cajón que se abre con el botón ☰.
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  const visibleNav = NAV.map((entry) =>
    entry.items ? { ...entry, items: entry.items.filter((item) => hasSection(item.section)) } : entry
  ).filter((entry) => (entry.items ? entry.items.length > 0 : entry.section === null || hasSection(entry.section)));

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

  const renderLink = (item) => (
    <NavLink key={item.to} to={item.to} end={item.end}>
      {item.label || t(item.labelKey)}
      {item.badge && newMessagesCount > 0 && <span className="admin-layout__nav-badge">{newMessagesCount}</span>}
    </NavLink>
  );

  // Se vuelve a consultar en cada cambio de ruta (no solo al montar) para
  // que el aviso no se quede desactualizado si alguien pasa un rato largo
  // en otra sección del panel sin recargar la página — es una consulta
  // barata, no vale la pena montar un polling con setInterval solo para
  // esto.
  useEffect(() => {
    if (!hasSection("mensajes")) return;
    db.getContactMessages()
      .then((messages) => setNewMessagesCount(messages.filter((m) => (m.status || "nuevo") === "nuevo").length))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside id="admin-sidebar" className={`admin-layout__sidebar${menuOpen ? " is-open" : ""}`}>
        <NavLink to="/" className="admin-layout__logo">
          <Logo variant="white" size="sm" />
        </NavLink>
        <nav>
          {visibleNav.map((entry) => {
            if (!entry.items) return renderLink(entry);
            const open = openGroups.includes(entry.key);
            const hasBadge = !open && newMessagesCount > 0 && entry.items.some((i) => i.badge);
            return (
              <div key={entry.key} className="admin-layout__group">
                <button
                  type="button"
                  className="admin-layout__group-toggle"
                  aria-expanded={open}
                  onClick={() => toggleGroup(entry.key)}
                >
                  <span>{t(entry.labelKey)}</span>
                  {hasBadge && <span className="admin-layout__nav-badge">{newMessagesCount}</span>}
                  <span className={`admin-layout__chevron${open ? " is-open" : ""}`} aria-hidden="true">›</span>
                </button>
                {open && <div className="admin-layout__group-items">{entry.items.map(renderLink)}</div>}
              </div>
            );
          })}
        </nav>
        <button type="button" className="admin-layout__logout" onClick={handleLogout}>
          {t("admin.logout")}
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
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </header>
        <main className="admin-layout__content">
          <ErrorBoundary key={pathname} homePath="/admin">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

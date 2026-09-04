import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import LanguageToggle from "../../components/LanguageToggle";
import { useAuth } from "../../context/AuthContext";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { t } = useTranslation();
  const { logout, hasSection } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="admin-layout">
      <aside className="admin-layout__sidebar">
        <NavLink to="/" className="admin-layout__logo">
          <Logo variant="white" size="sm" />
        </NavLink>
        <nav>
          <NavLink to="/admin" end>{t("admin.dashboard")}</NavLink>
          {hasSection("propiedades") && <NavLink to="/admin/propiedades">{t("admin.properties")}</NavLink>}
          {hasSection("asesores") && <NavLink to="/admin/asesores">{t("admin.advisors")}</NavLink>}
          {hasSection("zonas") && <NavLink to="/admin/zonas">{t("admin.zones")}</NavLink>}
          {hasSection("clientes") && <NavLink to="/admin/clientes">{t("admin.clients")}</NavLink>}
          {hasSection("remodelaciones") && <NavLink to="/admin/remodelaciones">{t("admin.remodelProjects")}</NavLink>}
          {hasSection("materiales") && <NavLink to="/admin/materiales">{t("materialsCatalog.title")}</NavLink>}
          {hasSection("credito_infonavit") && <NavLink to="/admin/credito-infonavit">{t("admin.infonavitSimulator")}</NavLink>}
          {hasSection("roles") && <NavLink to="/admin/roles">{t("accessControl.sections.roles")}</NavLink>}
        </nav>
        <button type="button" className="admin-layout__logout" onClick={handleLogout}>
          {t("admin.logout")}
        </button>
      </aside>

      <div className="admin-layout__main">
        <header className="admin-layout__topbar">
          <span />
          <div className="admin-layout__topbar-actions">
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </header>
        <main className="admin-layout__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

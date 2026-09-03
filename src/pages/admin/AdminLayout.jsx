import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";
import LanguageToggle from "../../components/LanguageToggle";
import { useAuth } from "../../context/AuthContext";
import "./AdminLayout.css";

export default function AdminLayout() {
  const { t } = useTranslation();
  const { logout } = useAuth();
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
          <NavLink to="/admin/propiedades">{t("admin.properties")}</NavLink>
          <NavLink to="/admin/asesores">{t("admin.advisors")}</NavLink>
          <NavLink to="/admin/zonas">{t("admin.zones")}</NavLink>
          <NavLink to="/admin/clientes">{t("admin.clients")}</NavLink>
          <NavLink to="/admin/remodelaciones">{t("admin.remodelProjects")}</NavLink>
          <NavLink to="/admin/materiales">{t("materialsCatalog.title")}</NavLink>
          <NavLink to="/admin/credito-infonavit">{t("admin.infonavitSimulator")}</NavLink>
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

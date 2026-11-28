import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EmptyState from "../../components/EmptyState";

// Una dirección que no existe dentro de /admin: se queda en el panel (con su menú) en vez de salir al 404 del sitio público.
export default function AdminNotFound() {
  const { t } = useTranslation();
  return (
    <EmptyState illustration="signpost" title={t("admin.notFound.title")} text={t("admin.notFound.text")} as="h1">
      <Link to="/admin" className="btn btn-primary">{t("admin.notFound.back")}</Link>
    </EmptyState>
  );
}

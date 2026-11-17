import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import EmptyState from "../components/EmptyState";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="container">
      <Seo title="404" description={t("notFound.seoDescription")} />
      <EmptyState illustration="signpost" title={`404 · ${t("notFound.title")}`} text={t("notFound.text")} as="h1" className="not-found">
        <Link to="/" className="btn btn-primary">{t("notFound.home")}</Link>
        <Link to="/propiedades" className="btn btn-outline">{t("notFound.browse")}</Link>
      </EmptyState>
    </div>
  );
}

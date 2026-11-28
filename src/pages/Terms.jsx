import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import "./Privacy.css";

// Términos y condiciones de uso del sitio. Mismo formato que el aviso de privacidad (secciones en i18n). El texto es un borrador que
// describe lo que hace el sitio: debe revisarlo quien lleve lo legal antes de darlo por definitivo.
export default function Terms() {
  const { t } = useTranslation();
  const sections = t("terms.sections", { returnObjects: true });

  return (
    <>
      <Seo title={t("terms.title")} description={t("terms.intro")} />

      <div className="container privacy-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 0.5rem" }}>
          <h1>{t("terms.title")}</h1>
          <p>{t("terms.intro")}</p>
        </div>
        <p className="privacy-page__updated">{t("terms.updated")}</p>

        <div className="privacy-page__sections">
          {sections.map((section) => (
            <div className="card privacy-page__block" key={section.title}>
              <h2 style={{ fontSize: "1.1rem" }}>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
        <p className="privacy-page__updated">
          <Link to="/aviso-de-privacidad">{t("footer.privacyLink")}</Link> · <Link to="/carta-de-derechos">{t("footer.rightsLink")}</Link>
        </p>
      </div>
    </>
  );
}

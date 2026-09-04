import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import "./Privacy.css";

export default function Privacy() {
  const { t } = useTranslation();
  const sections = t("privacy.sections", { returnObjects: true });

  return (
    <>
      <Seo title={t("privacy.title")} description={t("privacy.intro")} />

      <div className="container privacy-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 0.5rem" }}>
          <h2>{t("privacy.title")}</h2>
          <p>{t("privacy.intro")}</p>
        </div>
        <p className="privacy-page__updated">{t("privacy.updated")}</p>

        <div className="privacy-page__sections">
          {sections.map((section) => (
            <div className="card privacy-page__block" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

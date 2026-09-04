import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import "./Privacy.css";

export default function Rights() {
  const { t } = useTranslation();
  const items = t("rights.items", { returnObjects: true });

  return (
    <>
      <Seo title={t("rights.title")} description={t("rights.intro")} />

      <div className="container privacy-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 0.5rem" }}>
          <h2>{t("rights.title")}</h2>
          <p>{t("rights.intro")}</p>
        </div>
        <p className="privacy-page__updated">{t("rights.footnote")}</p>

        <ol className="card privacy-page__block privacy-page__rights-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>
    </>
  );
}

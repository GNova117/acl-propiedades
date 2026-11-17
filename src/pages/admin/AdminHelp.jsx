import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import AdminTour from "../../components/AdminTour";
import { markTourSeen, searchTopics, visibleTopics } from "../../lib/helpTopics";
import "./admin.css";

// Centro de ayuda del panel: temas por apartado (solo los que el rol tiene), con buscador, y el recorrido guiado.
export default function AdminHelp() {
  const { t } = useTranslation();
  const { hasSection, session } = useAuth();
  const [query, setQuery] = useState("");
  const [touring, setTouring] = useState(false);

  const topics = useMemo(() => visibleTopics(hasSection), [hasSection]);
  const points = (topic) => t(`help.topics.${topic.key}.points`, { returnObjects: true });
  const text = (topic) => `${t(`help.topics.${topic.key}.title`)} ${points(topic).join(" ")}`;
  const shown = searchTopics(topics, query, text);

  return (
    <div>
      <div className="admin-header">
        <h1>{t("help.title")}</h1>
        <div className="admin-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setTouring(true)}>
            {t("help.tour.start")}
          </button>
        </div>
      </div>
      <p className="form-hint">{t("help.hint")}</p>
      <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("help.search")} aria-label={t("help.search")} style={{ maxWidth: 420, marginBottom: "1rem" }} />

      {shown.length === 0 ? (
        <p className="card empty-state">{t("help.empty")}</p>
      ) : (
        <div className="help-topics">
          {shown.map((topic) => (
            <details key={topic.key} className="card help-topic" open={Boolean(query.trim())}>
              <summary>{t(`help.topics.${topic.key}.title`)}</summary>
              <ul>
                {points(topic).map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
              {topic.to && (
                <Link to={topic.to} className="btn btn-outline btn-sm">
                  {t("help.goThere")}
                </Link>
              )}
            </details>
          ))}
        </div>
      )}

      {touring && (
        <AdminTour
          onClose={() => {
            markTourSeen(session?.user?.email);
            setTouring(false);
          }}
        />
      )}
    </div>
  );
}

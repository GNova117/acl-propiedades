import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { developmentStats } from "../../lib/developments";
import { formatMXN } from "../../lib/format";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";
import { notifyLoadError } from "../../lib/loadError";

export default function AdminDevelopments() {
  const { t } = useTranslation();
  const [developments, setDevelopments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getDevelopments()
      .then(setDevelopments)
      .catch(notifyLoadError).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (development) => {
    if (!await confirmDialog(t("developments.admin.deleteConfirm"))) return;
    setDeletingId(development.id);
    try {
      await db.deleteDevelopment(development.id);
      load();
    } catch (err) {
      notify(err.message || t("developments.admin.saveError"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("developments.admin.title")}</h1>
        <div className="admin-header__actions">
          <Link to="/admin/desarrollos/nuevo" className="btn btn-primary">
            {t("developments.admin.new")}
          </Link>
        </div>
      </div>
      <p className="form-hint mt-n3 mb-5">
        {t("developments.admin.subtitle")}
      </p>

      {loading ? (
        <LoadingState variant="lines" />
      ) : developments.length === 0 ? (
        <p className="form-hint">{t("developments.admin.empty")}</p>
      ) : (
        <div className="admin-zones-grid">
          {developments.map((development) => {
            const stats = developmentStats(development);
            return (
              <div key={development.id} className="card admin-zone-card">
                {development.hero_image && <img src={development.hero_image} alt="" className="admin-zone-card__thumb" />}
                <h3>{development.name}</h3>
                <span className={`badge ${development.published ? "badge-available" : "badge-sold"}`}>
                  {development.published ? t("developments.admin.published") : t("developments.admin.draft")}
                </span>
                <p className="form-hint mt-2">
                  {development.zone} · {stats.total} deptos
                  {stats.fromPrice != null && <> · {t("developments.card.from", { price: formatMXN(stats.fromPrice) })}</>}
                  <br />
                  {t("developments.admin.unitsSummary", { available: stats.available, reserved: stats.reserved, sold: stats.sold })}
                </p>
                <div className="admin-zone-card__row">
                  <Link to={`/admin/desarrollos/${development.id}`} className="btn btn-outline btn-sm">
                    {t("common.edit")}
                  </Link>
                  {development.published && (
                    <Link to={`/desarrollos/${development.slug}`} className="btn btn-outline btn-sm" target="_blank">
                      {t("developments.admin.viewPublic")}
                    </Link>
                  )}
                  <button type="button" className="btn btn-danger btn-sm" disabled={deletingId === development.id} onClick={() => handleDelete(development)}>
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

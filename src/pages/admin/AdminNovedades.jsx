import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";
import { notifyLoadError } from "../../lib/loadError";

const formatDate = (iso, locale) =>
  new Date(iso).toLocaleString(locale === "en" ? "en-US" : "es-MX", { dateStyle: "long", timeStyle: "short" });

// Bitácora interna de cambios del sitio: cada entrada es un cambio o mejora
// hecho al sitio, separado de todos los demás, para que quien tenga este
// apartado pueda darle seguimiento sin mezclarlo con el registro de
// actividad (ese lo escriben los triggers de la base de datos; este lo
// escribe el equipo a mano, como un blog, pero nunca se muestra fuera del
// panel admin).
export default function AdminNovedades() {
  const { t, i18n } = useTranslation();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const load = () => {
    setLoading(true);
    db.getSiteUpdates().then((data) => {
      setUpdates(data);
      setLoading(false);
    }).catch((err) => { notifyLoadError(err); setLoading(false); });
  };

  useEffect(load, []);

  const handleDelete = async (update) => {
    if (!await confirmDialog(t("common.confirmDelete"))) return;
    setDeletingId(update.id);
    try {
      await db.deleteSiteUpdate(update.id);
      load();
    } catch (err) {
      notify(err.message || "Error al eliminar la entrada");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>{t("novedades.admin.title")}</h1>
        <div className="admin-header__actions">
          <Link to="/admin/novedades/nueva" className="btn btn-primary">
            {t("novedades.admin.new")}
          </Link>
        </div>
      </div>
      <p className="form-hint mt-n3 mb-5">{t("novedades.admin.subtitle")}</p>

      {loading ? (
        <LoadingState variant="lines" />
      ) : updates.length === 0 ? (
        <p className="form-hint">{t("novedades.admin.empty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {updates.map((update) => (
            <div key={update.id} className="card">
              <div className="admin-header mb-2">
                <h3 className="m-0">{update.title}</h3>
                <div className="admin-header__actions">
                  <Link to={`/admin/novedades/${update.id}`} className="btn btn-outline btn-sm">
                    {t("common.edit")}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(update)}
                    disabled={deletingId === update.id}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </div>
              <p className="form-hint mt-0 mb-3">
                {t("novedades.admin.postedOn", { date: formatDate(update.created_at, i18n.language) })}
                {update.created_by ? ` · ${update.created_by}` : ""}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{update.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

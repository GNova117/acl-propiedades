import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { clientSheetData, clientSheetSections } from "../lib/clientExpedienteFields";
import { downloadMultiPerfilamientoPdf } from "../lib/perfilamientoPdf";
import "./ExpedienteAvaluoModal.css";

function clientTypeLabel(t, type) {
  return t(`clients.${type === "comprador" ? "buyer" : type === "vendedor" ? "seller" : "both"}`);
}

// PDF de varios clientes a la vez (misma ficha que ya descarga
// AdminClientForm.jsx, ver clientSheetSections), elegidos desde la lista en
// vez de entrar uno por uno a "Acciones". Al marcar un cliente que tiene
// expediente conjunto (vínculo guardado en client_links), su pareja se
// marca sola — vendedor con vendedor, el caso que sea — aunque no cumpla el
// filtro de tipo/búsqueda actual.
export default function ClientPdfModal({ initialTypeFilter, onClose }) {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [linkMap, setLinkMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter || "");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([db.getClients(), db.getAllClientLinks()]).then(([clientsData, links]) => {
      const map = new Map();
      links.forEach((link) => {
        map.set(link.client_a_id, link.client_b_id);
        map.set(link.client_b_id, link.client_a_id);
      });
      setClients(clientsData);
      setLinkMap(map);
      setLoading(false);
    });
  }, []);

  const clientsById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const visibleClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (term && !c.name?.toLowerCase().includes(term) && !c.phone?.includes(term)) return false;
      return true;
    });
  }, [clients, typeFilter, query]);

  const visibleIds = useMemo(() => new Set(visibleClients.map((c) => c.id)), [visibleClients]);
  const allVisibleSelected = visibleClients.length > 0 && visibleClients.every((c) => selected.has(c.id));

  // Agrega el id y, si tiene pareja vinculada, también la pareja — así
  // nunca se descarga la ficha de uno sin la del otro.
  const addWithLinked = (ids, id) => {
    ids.add(id);
    const partnerId = linkMap.get(id);
    if (partnerId && clientsById.has(partnerId)) ids.add(partnerId);
  };

  const toggleClient = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else addWithLinked(next, id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleClients.forEach((c) => next.delete(c.id));
      } else {
        visibleClients.forEach((c) => addWithLinked(next, c.id));
      }
      return next;
    });
  };

  // Vinculados que entraron solos por ser pareja de alguien marcado, aunque
  // no cumplan el filtro/búsqueda actual — se avisan aparte para que quede
  // claro por qué están en la cuenta.
  const autoIncluded = useMemo(
    () =>
      Array.from(selected)
        .map((id) => clientsById.get(id))
        .filter((c) => c && !visibleIds.has(c.id)),
    [selected, clientsById, visibleIds]
  );

  const handleDownload = async () => {
    const selectedClients = Array.from(selected)
      .map((id) => clientsById.get(id))
      .filter(Boolean);
    if (!selectedClients.length) return;
    setBusy(true);
    setError("");
    try {
      const entries = selectedClients.map((c) => ({
        data: clientSheetData(c),
        sections: clientSheetSections(c),
        options: { title: "DATOS DEL CLIENTE" },
        nombre: c.name,
      }));
      await downloadMultiPerfilamientoPdf(entries, "Clientes");
      onClose();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="expediente-avaluo">
      <div className="expediente-avaluo__card card">
        <div className="expediente-avaluo__header">
          <div>
            <h3>{t("clients.pdfModalTitle")}</h3>
            <p className="form-hint">{t("clients.pdfModalSubtitle")}</p>
          </div>
          <button type="button" className="expediente-avaluo__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="empty-state">{t("common.loading")}</div>
        ) : (
          <>
            <div className="form-row">
              <div className="form-field">
                <label htmlFor="pdf-modal-type">{t("clients.type")}</label>
                <select id="pdf-modal-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">—</option>
                  <option value="comprador">{t("clients.buyer")}</option>
                  <option value="vendedor">{t("clients.seller")}</option>
                  <option value="ambos">{t("clients.both")}</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="pdf-modal-search">{t("common.search")}</label>
                <input
                  id="pdf-modal-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("clients.searchPlaceholder")}
                />
              </div>
            </div>

            <label className="expediente-avaluo__option">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
              {t("clients.selectAllVisible", { count: visibleClients.length })}
            </label>

            <div className="expediente-avaluo__list">
              {visibleClients.length === 0 ? (
                <p className="form-hint">{t("clients.noResults")}</p>
              ) : (
                visibleClients.map((c) => (
                  <label key={c.id} className="expediente-avaluo__option">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleClient(c.id)} />
                    {c.name} · {clientTypeLabel(t, c.type)}
                  </label>
                ))
              )}
            </div>

            {autoIncluded.length > 0 && (
              <p className="form-hint">
                {t("clients.alsoIncludedLinked")}: {autoIncluded.map((c) => c.name).join(", ")}
              </p>
            )}

            {error && <p className="form-error">{error}</p>}

            <div className="admin-form__actions">
              <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy || selected.size === 0}>
                {busy ? <span className="spinner" /> : null}
                {t("clients.downloadPdf")} ({selected.size})
              </button>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

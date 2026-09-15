import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { AVALUO_BUYER_DOCS, AVALUO_SELLER_DOCS, downloadExpedienteAvaluoPdf } from "../lib/expedienteAvaluoPdf";
import "./ExpedienteAvaluoModal.css";

// Armado del expediente para avalúos: se eligen aquí las personas (uno o
// los dos compradores de un expediente conjunto, más el vendedor) y se
// descarga todo en un solo PDF. No se guarda ninguna relación
// comprador-vendedor en la base: el expediente se arma al momento de
// descargarlo, porque la misma persona puede entrar en varios avalúos.
export default function ExpedienteAvaluoModal({ client, linkedClient, onClose }) {
  const { t } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buyerIds, setBuyerIds] = useState([]);
  const [sellerId, setSellerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    db.getClients().then((data) => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  // El cliente desde el que se abrió el modal entra preseleccionado según su
  // tipo, y si tiene expediente conjunto el otro también — así el caso real
  // (pareja acreditada + vendedor) queda listo con un solo clic más.
  useEffect(() => {
    const isSeller = client.type === "vendedor";
    if (isSeller) {
      setSellerId(client.id);
      return;
    }
    const ids = [client.id];
    if (linkedClient && linkedClient.type !== "vendedor") ids.push(linkedClient.id);
    setBuyerIds(ids);
    if (linkedClient?.type === "vendedor") setSellerId(linkedClient.id);
  }, [client, linkedClient]);

  const buyerCandidates = useMemo(() => clients.filter((c) => c.type === "comprador" || c.type === "ambos"), [clients]);
  const sellerCandidates = useMemo(() => clients.filter((c) => c.type === "vendedor" || c.type === "ambos"), [clients]);

  const toggleBuyer = (id) => {
    setBuyerIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDownload = async () => {
    setBusy(true);
    setError("");
    try {
      const buyers = buyerIds.map((id) => clients.find((c) => c.id === id)).filter(Boolean);
      const seller = sellerCandidates.find((c) => c.id === sellerId);

      const withDocs = async (list) =>
        Promise.all(list.map(async (c) => ({ client: c, docs: await db.getClientDocuments(c.id) })));

      const sections = [];
      if (buyers.length) {
        sections.push({ title: t("expedienteAvaluo.buyers"), docTypes: AVALUO_BUYER_DOCS, people: await withDocs(buyers) });
      }
      if (seller) {
        sections.push({ title: t("expedienteAvaluo.seller"), docTypes: AVALUO_SELLER_DOCS, people: await withDocs([seller]) });
      }

      await downloadExpedienteAvaluoPdf({
        sections,
        title: t("expedienteAvaluo.pdfTitle"),
        docTypeLabel: (docType) => t(`documentCapture.docTypes.${docType}`),
        labels: {
          contents: t("expedienteAvaluo.contents"),
          generatedOn: t("expedienteAvaluo.generatedOn"),
          missing: t("expedienteAvaluo.missing"),
          failed: t("expedienteAvaluo.failed"),
        },
      });
      onClose();
    } catch (err) {
      console.error("downloadExpedienteAvaluoPdf", err);
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const nothingSelected = buyerIds.length === 0 && !sellerId;

  return (
    <div className="expediente-avaluo">
      <div className="expediente-avaluo__card card">
        <div className="expediente-avaluo__header">
          <div>
            <h3>{t("expedienteAvaluo.title")}</h3>
            <p className="form-hint">{t("expedienteAvaluo.subtitle")}</p>
          </div>
          <button type="button" className="expediente-avaluo__close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="empty-state">{t("common.loading")}</div>
        ) : (
          <>
            <div className="form-field">
              <label>{t("expedienteAvaluo.buyers")}</label>
              <div className="expediente-avaluo__list">
                {buyerCandidates.length === 0 ? (
                  <p className="form-hint">{t("expedienteAvaluo.noBuyers")}</p>
                ) : (
                  buyerCandidates.map((c) => (
                    <label key={c.id} className="expediente-avaluo__option">
                      <input type="checkbox" checked={buyerIds.includes(c.id)} onChange={() => toggleBuyer(c.id)} />
                      {c.name}
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="expediente-seller">{t("expedienteAvaluo.seller")}</label>
              <select id="expediente-seller" value={sellerId} onChange={(e) => setSellerId(e.target.value)}>
                <option value="">—</option>
                {sellerCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="form-error">{t("expedienteAvaluo.downloadError")} ({error})</p>}

            <div className="admin-form__actions">
              <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy || nothingSelected}>
                {busy ? <span className="spinner" /> : null}
                {t("expedienteAvaluo.download")}
              </button>
              <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
                {t("common.cancel")}
              </button>
            </div>
            {busy && <p className="form-hint">{t("expedienteAvaluo.building")}</p>}
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { CONTRACT_KINDS, contractState, validateContract } from "../lib/contracts";
import "./PropertyProspectsModal.css";
import "./PropertyOffersModal.css";
import { confirmDialog } from "../lib/toast";

// «Contrato» de una propiedad: si está en exclusiva o abierta y cuándo vence, para que Mi día avise antes de que venza.
// Es un dato interno (no se publica en el sitio). `onChanged()` pide recargar la lista de contratos.
export default function PropertyContractModal({ property, contract, onClose, onChanged }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ kind: contract?.kind || "exclusiva", expiresOn: contract?.expires_on || "", note: contract?.note || "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const state = contract ? contractState(contract) : null;

  const save = async (e) => {
    e.preventDefault();
    const checked = validateContract(form);
    if (checked.error) {
      setError(t(`contract.errors.${checked.error}`));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await db.setPropertyContract(property.id, form);
      onChanged?.();
      onClose();
    } catch {
      setError(t("contract.errors.generic"));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!await confirmDialog(t("contract.confirmRemove"))) return;
    setBusy(true);
    try {
      await db.deletePropertyContract(property.id);
      onChanged?.();
      onClose();
    } catch {
      setError(t("contract.errors.generic"));
      setBusy(false);
    }
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("contract.title")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card offers-modal">
        <div className="match-modal__head">
          <h2>{t("contract.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="form-hint">{t("contract.hint", { title: property.title })}</p>
        {state && (
          <p role="status">
            <span className={`prospect-chip${state.state === "vencido" ? " prospect-chip--overdue" : state.state === "vigente" ? "" : " prospect-chip--today"}`}>
              {t(`contract.states.${state.state}`, { count: Math.abs(state.daysLeft) })}
            </span>
          </p>
        )}
        <form className="offers-modal__form" onSubmit={save} noValidate>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="contract-kind">{t("contract.kind")}</label>
              <select id="contract-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                {CONTRACT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`contract.kinds.${kind}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="contract-expires">{t("contract.expires")}</label>
              <input id="contract-expires" type="date" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="contract-note">{t("offers.note")}</label>
            <input id="contract-note" maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="offers-modal__actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
              {t("common.save")}
            </button>
            {contract && (
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={remove}>
                {t("contract.remove")}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

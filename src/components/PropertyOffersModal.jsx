import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import { holdState, offersSummary, validateHold, validateOffer } from "../lib/offers";
import "./PropertyProspectsModal.css";
import "./PropertyOffersModal.css";
import LoadingState from "./LoadingState";
import { confirmDialog } from "../lib/toast";

const dateLabel = (iso, lang) => new Date(`${iso}T00:00:00`).toLocaleDateString(lang?.startsWith("en") ? "en-US" : "es-MX", { day: "numeric", month: "short", year: "numeric" });
const errorText = (t, err) => {
  const code = String(err?.message || "");
  const match = /^(offer|hold):(\w+)$/.exec(code);
  return match ? t(`offers.errors.${match[1]}.${match[2]}`, { defaultValue: t("offers.errors.generic") }) : err?.message || t("offers.errors.generic");
};

// «Ofertas y apartado» de una propiedad: las ofertas del cliente y contraofertas del propietario (quién, cuánto, nota,
// estado) y el apartado (monto y fecha límite, con aviso de «por vencer»). `onChanged()` avisa a la lista para que
// recargue (apartar o cancelar cambia el estatus de la propiedad).
export default function PropertyOffersModal({ property, onClose, onChanged }) {
  const { t, i18n } = useTranslation();
  const [offers, setOffers] = useState([]);
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offerForm, setOfferForm] = useState({ party: "cliente", buyerName: "", amount: "", note: "" });
  const [holdForm, setHoldForm] = useState({ buyerName: "", buyerPhone: "", amount: "", dueDate: "", note: "" });
  const today = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = useCallback(async () => {
    const [o, h] = await Promise.all([db.getPropertyOffers(property.id), db.getPropertyHolds(property.id)]);
    setOffers(o);
    setHolds(h);
    setLoading(false);
  }, [property.id]);

  useEffect(() => {
    load().catch((err) => {
      setError(errorText(t, err));
      setLoading(false);
    });
  }, [load, t]);

  const run = async (fn, { reloadList = false } = {}) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
      if (reloadList) onChanged?.();
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy(false);
    }
  };

  const summary = useMemo(() => offersSummary(offers, property.price), [offers, property.price]);
  const activeHold = holds.find((h) => h.status === "vigente");

  const submitOffer = (e) => {
    e.preventDefault();
    const checked = validateOffer(offerForm);
    if (checked.error) {
      setError(t(`offers.errors.offer.${checked.error}`));
      return;
    }
    run(async () => {
      await db.addPropertyOffer(property.id, offerForm);
      setOfferForm((f) => ({ ...f, amount: "", note: "" }));
    });
  };

  const submitHold = (e) => {
    e.preventDefault();
    const checked = validateHold(holdForm, today);
    if (checked.error) {
      setError(t(`offers.errors.hold.${checked.error}`));
      return;
    }
    run(
      async () => {
        await db.addPropertyHold(property.id, holdForm);
        setHoldForm({ buyerName: "", buyerPhone: "", amount: "", dueDate: "", note: "" });
      },
      { reloadList: true }
    );
  };

  const closeHold = async (hold, status) => {
    if (status === "cancelado" && !await confirmDialog(t("offers.hold.confirmCancel"))) return;
    run(() => db.setPropertyHoldStatus(hold.id, status), { reloadList: true });
  };

  const holdChip = (hold) => {
    const { state, daysLeft } = holdState(hold, today);
    const text =
      state === "vencido"
        ? t("offers.hold.overdue", { count: Math.abs(daysLeft) })
        : state === "porVencer"
          ? daysLeft === 0
            ? t("offers.hold.dueToday")
            : t("offers.hold.dueSoon", { count: daysLeft })
          : t(`offers.hold.states.${state}`);
    return <span className={`prospect-chip${state === "vencido" ? " prospect-chip--overdue" : state === "porVencer" ? " prospect-chip--today" : ""}`}>{text}</span>;
  };

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("offers.title")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card offers-modal">
        <div className="match-modal__head">
          <h2>{t("offers.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        <p className="form-hint">{t("offers.subtitle", { title: property.title, price: formatMXN(property.price) })}</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <LoadingState variant="lines" />
        ) : (
          <>
            <section aria-labelledby="offers-hold-title">
              <h3 id="offers-hold-title">{t("offers.hold.title")}</h3>
              {activeHold ? (
                <div className="offers-modal__row offers-modal__row--hold">
                  <div>
                    <strong>{activeHold.buyer_name}</strong> {holdChip(activeHold)}
                    <p className="form-hint">
                      {t("offers.hold.summary", { amount: formatMXN(activeHold.amount), date: dateLabel(activeHold.due_date, i18n.language) })}
                      {activeHold.buyer_phone ? ` · ${activeHold.buyer_phone}` : ""}
                    </p>
                    {activeHold.note && <p className="form-hint">{activeHold.note}</p>}
                  </div>
                  <div className="offers-modal__actions">
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => closeHold(activeHold, "concretado")}>
                      {t("offers.hold.complete")}
                    </button>
                    <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => closeHold(activeHold, "cancelado")}>
                      {t("offers.hold.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <form className="offers-modal__form" onSubmit={submitHold} noValidate>
                  <p className="form-hint">{t("offers.hold.hint")}</p>
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="hold-name">{t("offers.hold.buyer")}</label>
                      <input id="hold-name" value={holdForm.buyerName} maxLength={120} onChange={(e) => setHoldForm({ ...holdForm, buyerName: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="hold-phone">{t("offers.hold.phone")}</label>
                      <input id="hold-phone" type="tel" value={holdForm.buyerPhone} maxLength={30} onChange={(e) => setHoldForm({ ...holdForm, buyerPhone: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="hold-amount">{t("offers.hold.amount")}</label>
                      <input id="hold-amount" type="number" min="0" inputMode="numeric" value={holdForm.amount} onChange={(e) => setHoldForm({ ...holdForm, amount: e.target.value })} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="hold-due">{t("offers.hold.due")}</label>
                      <input id="hold-due" type="date" min={today} value={holdForm.dueDate} onChange={(e) => setHoldForm({ ...holdForm, dueDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="hold-note">{t("offers.note")}</label>
                    <input id="hold-note" value={holdForm.note} maxLength={300} onChange={(e) => setHoldForm({ ...holdForm, note: e.target.value })} />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    {t("offers.hold.save")}
                  </button>
                </form>
              )}
              {holds.filter((h) => h.status !== "vigente").length > 0 && (
                <ul className="offers-modal__history">
                  {holds
                    .filter((h) => h.status !== "vigente")
                    .map((h) => (
                      <li key={h.id} className="form-hint">
                        {t("offers.hold.pastItem", { name: h.buyer_name, amount: formatMXN(h.amount), status: t(`offers.hold.states.${h.status}`) })}
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="offers-list-title">
              <h3 id="offers-list-title">{t("offers.offersTitle")}</h3>
              {summary.best && (
                <p className="offers-modal__best">
                  {t("offers.best", { amount: formatMXN(summary.best.amount), name: summary.best.buyer_name })}
                  {summary.pctVsList != null && <span className="form-hint"> · {t(summary.pctVsList >= 0 ? "offers.aboveList" : "offers.belowList", { pct: Math.abs(summary.pctVsList) })}</span>}
                </p>
              )}
              {offers.length === 0 ? (
                <p className="form-hint">{t("offers.none")}</p>
              ) : (
                <ul className="offers-modal__list">
                  {offers.map((o) => (
                    <li key={o.id} className="offers-modal__row">
                      <div>
                        <strong>{formatMXN(o.amount)}</strong> <span className="prospect-chip">{t(`offers.parties.${o.party}`)}</span>{" "}
                        <span className={`prospect-chip${o.status === "abierta" ? " prospect-chip--today" : ""}`}>{t(`offers.statuses.${o.status}`)}</span>
                        <p className="form-hint">
                          {o.buyer_name} · {dateLabel(String(o.created_at).slice(0, 10), i18n.language)}
                          {o.note ? ` · ${o.note}` : ""}
                        </p>
                      </div>
                      <div className="offers-modal__actions">
                        {o.status === "abierta" && (
                          <>
                            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => db.setPropertyOfferStatus(o.id, "aceptada"))}>
                              {t("offers.accept")}
                            </button>
                            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => run(() => db.setPropertyOfferStatus(o.id, "rechazada"))}>
                              {t("offers.reject")}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={busy}
                          onClick={async () => await confirmDialog(t("common.confirmDelete")) && run(() => db.deletePropertyOffer(o.id))}
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form className="offers-modal__form" onSubmit={submitOffer} noValidate aria-label={t("offers.add")}>
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="offer-party">{t("offers.party")}</label>
                    <select id="offer-party" value={offerForm.party} onChange={(e) => setOfferForm({ ...offerForm, party: e.target.value })}>
                      <option value="cliente">{t("offers.parties.cliente")}</option>
                      <option value="propietario">{t("offers.parties.propietario")}</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label htmlFor="offer-name">{t("offers.buyer")}</label>
                    <input id="offer-name" value={offerForm.buyerName} maxLength={120} onChange={(e) => setOfferForm({ ...offerForm, buyerName: e.target.value })} />
                  </div>
                  <div className="form-field">
                    <label htmlFor="offer-amount">{t("offers.amount")}</label>
                    <input id="offer-amount" type="number" min="1" inputMode="numeric" value={offerForm.amount} onChange={(e) => setOfferForm({ ...offerForm, amount: e.target.value })} />
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="offer-note">{t("offers.note")}</label>
                  <input id="offer-note" value={offerForm.note} maxLength={300} onChange={(e) => setOfferForm({ ...offerForm, note: e.target.value })} />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                  {t("offers.add")}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

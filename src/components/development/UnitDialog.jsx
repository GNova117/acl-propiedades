import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import DevelopmentProvenance from "./DevelopmentProvenance";
import { filterUnits, unitWhatsappText, EMPTY_UNIT_FILTERS } from "../../lib/developments";
import { estimateMonthlyPayment } from "../../lib/monthlyEstimate";
import { formatMXN, formatArea } from "../../lib/format";
import { OFFICE_WHATSAPP } from "../../lib/office";
import "./development.css";

// Ficha de un departamento dentro de la página de la torre. Las fotos y el
// plano son los del modelo (no del depto); lo propio del depto es piso, vista,
// precio y estatus. Abre con ?depto=801, así el enlace se puede compartir.
export default function UnitDialog({ development, unit, onSelect, onClose }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("photos");
  const [copied, setCopied] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  useEffect(() => {
    setTab("photos");
    setPhoto(0);
    setCopied(false);
  }, [unit.number]);

  const monthly = estimateMonthlyPayment(unit);
  const siblings = useMemo(
    () =>
      filterUnits(development, { ...EMPTY_UNIT_FILTERS, model: unit.model, status: "disponible", sortBy: "price_asc" })
        .filter((u) => u.number !== unit.number)
        .slice(0, 6),
    [development, unit.model, unit.number]
  );

  const url = `${window.location.origin}/desarrollos/${development.slug}?depto=${encodeURIComponent(unit.number)}`;
  const whatsappUrl = `https://wa.me/${OFFICE_WHATSAPP}?text=${encodeURIComponent(unitWhatsappText(development, unit, url))}`;
  const gallery = unit.images;
  const showPlan = tab === "plan" && unit.plan_image;
  const image = showPlan ? unit.plan_image : gallery[photo] || development.hero_image;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(t("developments.dialog.copyLink"), url);
    }
  };

  return createPortal(
    <div className="dev-dialog" role="dialog" aria-modal="true" aria-label={t("developments.unit.title", { number: unit.number })}>
      <div className="dev-dialog__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="dev-dialog__panel">
        <button type="button" className="dev-dialog__close" onClick={onClose} aria-label={t("developments.dialog.close")}>
          ×
        </button>

        <div className="dev-dialog__media">
          {image && <img src={image} alt={`${unit.model_name} — ${development.name}`} />}
          <div className="dev-dialog__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={!showPlan} className={!showPlan ? "active" : ""} onClick={() => setTab("photos")}>
              {t("developments.dialog.photos")}
            </button>
            {unit.plan_image && (
              <button type="button" role="tab" aria-selected={Boolean(showPlan)} className={showPlan ? "active" : ""} onClick={() => setTab("plan")}>
                {t("developments.dialog.plan")}
              </button>
            )}
          </div>
          {!showPlan && gallery.length > 1 && (
            <div className="dev-dialog__thumbs">
              {gallery.map((src, index) => (
                <button key={src + index} type="button" className={index === photo ? "active" : ""} onClick={() => setPhoto(index)} aria-label={`${index + 1}`}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
          )}
          <p className="dev-dialog__note">{t("developments.dialog.illustrative")}</p>
        </div>

        <div className="dev-dialog__body">
          <DevelopmentProvenance development={development} compact />
          <div className="dev-dialog__head">
            <div>
              <p className="dev-dialog__eyebrow">{development.name}</p>
              <h2>{t("developments.unit.title", { number: unit.number })}</h2>
              <p className="dev-dialog__sub">
                {unit.model_name} · {t("developments.unit.floor", { floor: unit.floor })}
                {unit.view ? ` · ${t("developments.unit.view", { view: unit.view })}` : ""}
              </p>
            </div>
            <span className={`dev-status dev-status--${unit.status}`}>{t(`developments.legend.${unit.status}`)}</span>
          </div>

          <p className="dev-dialog__price">{formatMXN(unit.price)}</p>
          {monthly && <p className="dev-dialog__monthly">{t("developments.unit.perMonth", { amount: formatMXN(monthly.payment) })}</p>}

          <h3 className="dev-dialog__h3">{t("developments.dialog.specs")}</h3>
          <ul className="dev-specs">
            {unit.area_m2 != null && <li>{formatArea(unit.area_m2)}</li>}
            {unit.bedrooms != null && <li>{t("developments.model.bedrooms", { count: unit.bedrooms })}</li>}
            {unit.bathrooms != null && <li>{t("developments.model.bathrooms", { count: unit.bathrooms })}</li>}
            {unit.parking != null && <li>{t("developments.model.parking", { count: unit.parking })}</li>}
          </ul>

          {unit.status !== "disponible" && <p className="dev-dialog__unavailable">{t("developments.dialog.unavailable")}</p>}

          <div className="dev-dialog__actions">
            <a className="btn btn-primary" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              {t("developments.dialog.whatsapp")}
            </a>
            <button type="button" className="btn btn-outline" onClick={copyLink}>
              {copied ? t("developments.dialog.copied") : t("developments.dialog.copyLink")}
            </button>
          </div>

          {siblings.length > 0 && (
            <>
              <h3 className="dev-dialog__h3">{t("developments.dialog.otherInModel")}</h3>
              <ul className="dev-siblings">
                {siblings.map((s) => (
                  <li key={s.number}>
                    <button type="button" onClick={() => onSelect(s.number)}>
                      <strong>{s.number}</strong>
                      <span>{t("developments.unit.floor", { floor: s.floor })}</span>
                      <span>{formatMXN(s.price)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

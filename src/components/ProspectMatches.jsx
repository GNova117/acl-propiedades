import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatMXN } from "../lib/format";
import { criteriaSummary } from "../lib/prospectMatch";
import { sendLink, suggestPropertyMessage } from "../lib/prospectMessages";
import { propertiesShareMessage } from "../lib/propertyShare";
import SelectionBuilder from "./SelectionBuilder";

// Cuántas propiedades que le encajan se listan (el resto se cuenta).
const MAX_MATCHES = 5;
const MAX_SENT_TOGETHER = 3; // propiedades en un mismo mensaje de "enviar juntas"
const SELECTION_PICKS = 5; // las que vienen marcadas al armar una selección desde aquí

// "N propiedades le encajan": chip que despliega la lista, con un botón para
// mandarle cada una (o las primeras juntas) por WhatsApp o correo. Va en la
// tarjeta del prospecto y en su ficha (`defaultOpen`). `onSent(canal)` se llama
// al mandarle las propiedades juntas, para ofrecer registrar el contacto.
export default function ProspectMatches({ prospect, matches, advisorName = "", onSent, defaultOpen = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
  const [building, setBuilding] = useState(false);
  if (matches.length === 0) return null;

  const suggestionLink = (property) =>
    sendLink(prospect, suggestPropertyMessage(prospect, property, `${window.location.origin}/propiedades/${property.id}`), t("prospects.match.emailSubject"));

  // Las primeras coincidencias en un solo mensaje (una sola ida a WhatsApp en
  // vez de una por propiedad). null si el prospecto no tiene teléfono ni correo.
  const bundle = matches.length > 1
    ? sendLink(
        prospect,
        propertiesShareMessage(matches, { origin: window.location.origin, recipientName: prospect.name, advisorName, limit: MAX_SENT_TOGETHER }),
        t("prospects.match.emailSubject")
      )
    : null;

  return (
    <div className="prospect-matches">
      <button type="button" className="prospect-chip prospect-chip--match" onClick={() => setOpen(!open)} aria-expanded={open}>
        {t("prospects.match.count", { count: matches.length })} {open ? "▴" : "▾"}
      </button>
      {open && (
        <>
          <p className="form-hint">{t("prospects.match.looking", { text: criteriaSummary(prospect.search_criteria, t) })}</p>
          <ul className="prospect-matches__list">
            {matches.slice(0, MAX_MATCHES).map((property) => {
              const link = suggestionLink(property);
              return (
                <li key={property.id} className="prospect-matches__item">
                  <a href={`/propiedades/${property.id}`} target="_blank" rel="noopener noreferrer" className="prospect-matches__title">
                    {property.title}
                  </a>
                  <span className="form-hint">{[property.zone, formatMXN(property.price)].filter(Boolean).join(" · ")}</span>
                  {link && (
                    <a className="btn btn-outline btn-sm" href={link} target={link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                      {t("prospects.match.send")}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          {matches.length > MAX_MATCHES && <p className="form-hint">{t("prospects.match.more", { count: matches.length - MAX_MATCHES })}</p>}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setBuilding(true)}>
            {t("selection.list.new")}
          </button>
          {bundle && (
            <a
              className="btn btn-primary btn-sm"
              href={bundle}
              target={bundle.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              onClick={() => onSent?.(bundle.startsWith("http") ? "whatsapp" : "correo")}
            >
              {t("prospects.match.sendTop", { count: Math.min(matches.length, MAX_SENT_TOGETHER) })}
            </a>
          )}
        </>
      )}
      {building && (
        <SelectionBuilder
          prospect={prospect}
          initialIds={matches.slice(0, SELECTION_PICKS).map((p) => p.id)}
          onClose={() => setBuilding(false)}
          onSent={(channel) => {
            setBuilding(false);
            onSent?.(channel);
          }}
        />
      )}
    </div>
  );
}

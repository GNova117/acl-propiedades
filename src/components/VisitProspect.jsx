import { useTranslation } from "react-i18next";
import { isValidProspectPhone, whatsappNumber } from "../lib/visitReport";
import "./VisitProspect.css";

// El prospecto de una visita en las tablas internas del panel: su nombre y, si
// se marcó como posible cliente, la insignia, lo que busca y su teléfono (con
// enlace a WhatsApp para darle seguimiento). Solo se usa dentro de /admin: el
// informe del vendedor nunca recibe estos datos.
export default function VisitProspect({ visit }) {
  const { t } = useTranslation();

  return (
    <div className="visit-prospect">
      <span>{visit.prospect_name || "—"}</span>
      {visit.potential_client && (
        <>
          <span className="visit-lead">{t("visits.potentialClient")}</span>
          {visit.looking_for && (
            <span className="visit-prospect__line">
              <strong>{t("visits.lookingForPrefix")}:</strong> {visit.looking_for}
            </span>
          )}
          {visit.prospect_phone &&
            (isValidProspectPhone(visit.prospect_phone) ? (
              <a
                className="visit-prospect__line"
                href={`https://wa.me/${whatsappNumber(visit.prospect_phone)}`}
                target="_blank"
                rel="noreferrer"
                title={t("visits.writeWhatsapp")}
              >
                {visit.prospect_phone}
              </a>
            ) : (
              <span className="visit-prospect__line">{visit.prospect_phone}</span>
            ))}
        </>
      )}
    </div>
  );
}

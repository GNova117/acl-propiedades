import { useState } from "react";
import { useTranslation } from "react-i18next";
import { propertyTypeLabel } from "../lib/format";
import { propertyPath } from "../lib/propertyUrl.js";
import { OFFICE } from "../lib/office";
import { trackConversion } from "../lib/conversions";

// Datos de la oficina que lleva la ficha en PDF (en lugar de los del asesor, que no se publican).
const OFFICE_CONTACT = { phone: OFFICE.phoneDisplay, email: OFFICE.email };

// «Descargar ficha en PDF» de la ficha pública: la misma hoja membretada que arma el panel, sin
// los datos de los asesores. pdf-lib y la plantilla se cargan hasta que alguien lo pide.
export default function DownloadFichaButton({ property }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const { downloadFichaTecnicaPdf } = await import("../lib/propertyFichaPdf");
      await downloadFichaTecnicaPdf(property, {
        typeLabel: propertyTypeLabel(t, property.type),
        statusLabel: t(`propertyStatus.${property.status}`),
        publicVersion: true,
        office: { ...OFFICE_CONTACT, url: `${window.location.origin}${propertyPath(property)}` },
      });
      trackConversion("pdf_download", { property_id: property.id, property_type: property.type });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="download-ficha">
      <button type="button" className="btn btn-outline btn-sm" onClick={handleClick} disabled={busy}>
        {busy ? <span className="spinner" /> : null}
        {t("downloadFicha.button")}
      </button>
      {failed && <span className="form-error" role="alert">{t("downloadFicha.error")}</span>}
    </div>
  );
}

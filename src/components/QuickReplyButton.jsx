import { useTranslation } from "react-i18next";
import { whatsappDigits } from "../lib/format";
import "./QuickReplyButton.css";

// "Respuesta rápida" en Mensajes de contacto: eligiendo una plantilla se
// abre WhatsApp (si hay teléfono) o el correo (si no) con el texto ya
// listo. Es un <select> nativo en vez de un menú propio a propósito — el
// botón vive dentro de una tabla con overflow-x:auto (admin-table-wrapper),
// donde un menú desplegable propio se recortaría cerca del borde inferior;
// el popup nativo del navegador no tiene ese problema.
//
// `label`: texto del selector; por omisión "Respuesta rápida" (Mensajes).
// `onSend` (opcional): se llama justo después de abrir WhatsApp o el correo,
// con la plantilla elegida y el canal usado ("whatsapp" | "correo"). Prospectos
// lo usa para ofrecer registrar el contacto en cuanto el asesor regresa.
// Si las plantillas traen `recommended` (las de etapa del prospecto), se
// agrupan: `recommendedLabel` arriba con las sugeridas y `othersLabel` abajo.
export default function QuickReplyButton({ templates, phone, email, emailSubject, label, onSend, recommendedLabel, othersLabel }) {
  const { t } = useTranslation();
  const selectLabel = label || t("messages.quickReply");
  let digits = whatsappDigits(phone);
  if (digits.length === 10) digits = `52${digits}`;

  if (!digits && !email) return null;

  const handleChange = (e) => {
    const template = templates.find((tpl) => tpl.key === e.target.value);
    e.target.value = "";
    if (!template) return;
    if (digits) {
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(template.text)}`, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(template.text)}`;
    }
    onSend?.(template, digits ? "whatsapp" : "correo");
  };

  const option = (tpl) => (
    <option key={tpl.key} value={tpl.key}>
      {tpl.label}
    </option>
  );
  const recommended = templates.filter((tpl) => tpl.recommended);
  const others = templates.filter((tpl) => !tpl.recommended);
  const grouped = Boolean(recommendedLabel) && recommended.length > 0;

  return (
    <select className="quick-reply-select btn btn-outline btn-sm" value="" onChange={handleChange} aria-label={selectLabel}>
      <option value="" disabled>
        {selectLabel}
      </option>
      {grouped ? (
        <>
          <optgroup label={recommendedLabel}>{recommended.map(option)}</optgroup>
          {others.length > 0 && <optgroup label={othersLabel}>{others.map(option)}</optgroup>}
        </>
      ) : (
        templates.map(option)
      )}
    </select>
  );
}

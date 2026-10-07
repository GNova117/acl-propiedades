import { useTranslation } from "react-i18next";
import { whatsappDigits } from "../lib/format";
import "./QuickReplyButton.css";

// "Respuesta rápida" en Mensajes de contacto: eligiendo una plantilla se
// abre WhatsApp (si hay teléfono) o el correo (si no) con el texto ya
// listo. Es un <select> nativo en vez de un menú propio a propósito — el
// botón vive dentro de una tabla con overflow-x:auto (admin-table-wrapper),
// donde un menú desplegable propio se recortaría cerca del borde inferior;
// el popup nativo del navegador no tiene ese problema.
export default function QuickReplyButton({ templates, phone, email, emailSubject }) {
  const { t } = useTranslation();
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
  };

  return (
    <select className="quick-reply-select btn btn-outline btn-sm" value="" onChange={handleChange} aria-label={t("messages.quickReply")}>
      <option value="" disabled>
        {t("messages.quickReply")}
      </option>
      {templates.map((tpl) => (
        <option key={tpl.key} value={tpl.key}>
          {tpl.label}
        </option>
      ))}
    </select>
  );
}

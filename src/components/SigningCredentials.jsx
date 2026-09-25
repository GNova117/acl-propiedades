import { useState } from "react";
import { useTranslation } from "react-i18next";
import { whatsappDigits } from "../lib/format";
import { signingLink, signingWhatsappText } from "../lib/signing";

// Enlace y código de una solicitud de firma recién creada (o de un código nuevo).
// El código NO se vuelve a mostrar: en la base solo queda su hash.
export default function SigningCredentials({ request, phone, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState("");
  const link = signingLink(request.token);

  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* sin portapapeles: el campo se puede seleccionar a mano */
    }
    setCopied(what);
    setTimeout(() => setCopied(""), 2000);
  };

  let digits = whatsappDigits(phone);
  if (digits.length === 10) digits = `52${digits}`;
  const waHref = `https://wa.me/${digits}?text=${encodeURIComponent(signingWhatsappText(request))}`;

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem", borderLeft: "4px solid var(--color-primary)" }}>
      <h3 style={{ marginTop: 0 }}>{t("signing.credentials.title")}</h3>
      <p className="form-hint">{t("signing.credentials.hint")}</p>

      <div className="form-field">
        <label htmlFor="sign-link">{t("signing.credentials.link")}</label>
        <input id="sign-link" readOnly value={link} onFocus={(e) => e.target.select()} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", margin: "0.5rem 0 1rem" }}>
        <div>
          <span className="form-hint" style={{ display: "block" }}>
            {t("signing.credentials.code")}
          </span>
          <strong style={{ fontSize: "2rem", letterSpacing: "0.3em", fontFamily: "monospace" }}>{request.code}</strong>
        </div>
        <span className="form-error" style={{ flex: 1, minWidth: 200 }}>
          {t("signing.credentials.codeOnce")}
        </span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => copy("link", link)}>
          {copied === "link" ? t("signing.credentials.copied") : t("signing.credentials.copyLink")}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => copy("code", request.code)}>
          {copied === "code" ? t("signing.credentials.copied") : t("signing.credentials.copyCode")}
        </button>
        <a className="btn btn-outline btn-sm" href={waHref} target="_blank" rel="noopener noreferrer">
          {t("signing.credentials.whatsapp")}
        </a>
        <a className="btn btn-outline btn-sm" href={link} target="_blank" rel="noopener noreferrer">
          {t("signing.credentials.openHere")}
        </a>
        <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>
      <p className="form-hint" style={{ marginBottom: 0, marginTop: "0.75rem" }}>
        {t("signing.credentials.whatsappNote")}
      </p>
    </div>
  );
}

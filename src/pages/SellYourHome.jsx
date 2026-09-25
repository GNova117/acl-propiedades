import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Seo from "../components/Seo";
import { db } from "../lib/dataStore";
import { formatArea, propertyTypeLabel } from "../lib/format";
import { isValidPhone, sendLead } from "../lib/lead";
import "./PublicForms.css";

const INITIAL = { name: "", phone: "", type: "casa", zoneId: "", address: "", landArea: "", builtArea: "", expectedPrice: "", comments: "", empresa: "" };

// "¿Cuánto vale tu casa?": el dueño deja los datos de su propiedad y la
// solicitud llega a Mensajes (canal "estimacion") con los datos estructurados
// en `details`; desde ahí el equipo abre la Estimación de valor ya llenada.
export default function SellYourHome() {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    db.getZones().then(setZones).catch(() => setZones([]));
    db.getPropertyTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  const change = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const isLand = form.type === "terreno";

  const handleSubmit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    if (!form.phone.trim()) next.phone = t("contact.required");
    else if (!isValidPhone(form.phone)) next.phone = t("contactRequest.invalidPhone");
    if (!form.address.trim()) next.address = t("contact.required");
    if (!(Number(form.landArea) > 0)) next.landArea = t("contact.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus("sending");
    const zone = zones.find((z) => z.id === form.zoneId);
    const details = {
      tipo: form.type,
      zona: zone?.name || "",
      direccion: form.address.trim(),
      terreno_m2: Number(form.landArea) || 0,
      construccion_m2: isLand ? 0 : Number(form.builtArea) || 0,
      precio_esperado: Number(form.expectedPrice) || 0,
    };
    const message = [
      "Solicitud de estimación de valor — quiere vender o conocer el valor de su propiedad.",
      `Tipo: ${propertyTypeLabel(t, form.type)}${zone ? ` · Zona: ${zone.name}` : ""}`,
      `Dirección / colonia: ${details.direccion}`,
      `Terreno: ${formatArea(details.terreno_m2)}${details.construccion_m2 ? ` · Construcción: ${formatArea(details.construccion_m2)}` : ""}`,
      details.precio_esperado ? `Precio que espera: $${details.precio_esperado.toLocaleString("es-MX")}` : null,
      form.comments.trim() ? `Comentarios: ${form.comments.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const outcome = await sendLead({
      rateKey: "acl_estimacion_last_submit",
      honeypot: form.empresa,
      name: form.name,
      phone: form.phone,
      message,
      channel: "estimacion",
      details,
    });
    setStatus(outcome);
    if (outcome === "success") setForm(INITIAL);
  };

  return (
    <>
      <Seo title={t("sellHome.seoTitle")} description={t("sellHome.subtitle")} />
      <div className="container public-form-page">
        <div className="section-heading" style={{ margin: "2.5rem auto 2rem" }}>
          <h1 style={{ fontSize: "2rem" }}>{t("sellHome.title")}</h1>
          <p>{t("sellHome.subtitle")}</p>
        </div>

        <div className="card public-form-card">
          {status === "success" ? (
            <>
              <h2 style={{ marginTop: 0 }}>{t("sellHome.successTitle")}</h2>
              <p className="form-hint" style={{ color: "var(--color-success)" }}>
                {t("sellHome.success")}
              </p>
              <button type="button" className="btn btn-outline" onClick={() => setStatus("idle")}>
                {t("sellHome.another")}
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
                <label htmlFor="sh-empresa">Empresa</label>
                <input id="sh-empresa" name="empresa" value={form.empresa} onChange={change} tabIndex={-1} autoComplete="off" />
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="sh-name">{t("contact.name")} *</label>
                  <input id="sh-name" name="name" autoComplete="name" value={form.name} onChange={change} aria-invalid={Boolean(errors.name)} />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="sh-phone">{t("contact.phone")} *</label>
                  <input
                    id="sh-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder={t("contactRequest.phonePlaceholder")}
                    value={form.phone}
                    onChange={change}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && <span className="form-error">{errors.phone}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="sh-type">{t("sellHome.type")}</label>
                  <select id="sh-type" name="type" value={form.type} onChange={change}>
                    {(types.length ? types.filter((pt) => pt.active !== false) : [{ id: "casa", key: "casa" }]).map((pt) => (
                      <option key={pt.id} value={pt.key}>
                        {propertyTypeLabel(t, pt.key)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="sh-zone">{t("sellHome.zone")}</label>
                  <select id="sh-zone" name="zoneId" value={form.zoneId} onChange={change}>
                    <option value="">{t("sellHome.zoneUnknown")}</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="sh-address">{t("sellHome.address")} *</label>
                <input id="sh-address" name="address" autoComplete="street-address" value={form.address} onChange={change} placeholder={t("sellHome.addressPlaceholder")} aria-invalid={Boolean(errors.address)} />
                {errors.address && <span className="form-error">{errors.address}</span>}
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label htmlFor="sh-land">{t("sellHome.landArea")} *</label>
                  <input id="sh-land" name="landArea" type="number" min="0" step="any" inputMode="decimal" value={form.landArea} onChange={change} aria-invalid={Boolean(errors.landArea)} />
                  {errors.landArea && <span className="form-error">{errors.landArea}</span>}
                </div>
                {!isLand && (
                  <div className="form-field">
                    <label htmlFor="sh-built">{t("sellHome.builtArea")}</label>
                    <input id="sh-built" name="builtArea" type="number" min="0" step="any" inputMode="decimal" value={form.builtArea} onChange={change} />
                  </div>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="sh-price">{t("sellHome.expectedPrice")}</label>
                <input id="sh-price" name="expectedPrice" type="number" min="0" inputMode="numeric" value={form.expectedPrice} onChange={change} />
                <span className="form-hint">{t("sellHome.expectedPriceHint")}</span>
              </div>

              <div className="form-field">
                <label htmlFor="sh-comments">{t("sellHome.comments")}</label>
                <textarea id="sh-comments" name="comments" rows={3} value={form.comments} onChange={change} />
              </div>

              {status === "error" && <p className="form-error">{t("contact.error")}</p>}
              {status === "rateLimited" && <p className="form-error">{t("contact.rateLimited")}</p>}

              <button type="submit" className="btn btn-primary btn-block" disabled={status === "sending"}>
                {status === "sending" ? <span className="spinner" /> : null}
                {status === "sending" ? t("contact.sending") : t("sellHome.submit")}
              </button>
              <p className="form-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                {t("contact.privacyNotice")} <Link to="/aviso-de-privacidad">{t("contact.privacyLinkLabel")}</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { CONTRACT_DOC_TYPES, CONTRACT_FIELDS, buildContractContent, defaultContractValues, validateContractValues } from "../lib/contractDocs";
import { downloadContractPdf } from "../lib/contractPdf";

// Generador de documentos con datos del cliente y de la propiedad (recibo de
// apartado, autorización de venta, carta oferta). Vive en Documentos legales.
export default function ContractGenerator() {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [type, setType] = useState(CONTRACT_DOC_TYPES[0]);
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [signerId, setSignerId] = useState(advisorId || "");
  const [values, setValues] = useState(() => defaultContractValues(CONTRACT_DOC_TYPES[0], null));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.getClients().then(setClients).catch(() => setClients([]));
    db.getProperties({}).then(setProperties).catch(() => setProperties([]));
    db.getAdvisors().then(setAdvisors).catch(() => setAdvisors([]));
  }, []);

  const property = useMemo(() => properties.find((p) => p.id === propertyId), [properties, propertyId]);
  const client = useMemo(() => clients.find((c) => c.id === clientId), [clients, clientId]);
  const sortedProperties = useMemo(() => properties.slice().sort((a, b) => String(a.title).localeCompare(String(b.title))), [properties]);

  // Cambiar de documento o de propiedad reinicia los valores por omisión
  // (p. ej. el precio de lista de la autorización sale del precio de la propiedad).
  const resetValues = (nextType, nextProperty) => {
    setValues(defaultContractValues(nextType, nextProperty));
    setErrors({});
  };
  const changeType = (next) => {
    setType(next);
    resetValues(next, property);
  };
  const changeProperty = (id) => {
    setPropertyId(id);
    resetValues(type, properties.find((p) => p.id === id));
  };

  const setValue = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));

  const handleDownload = async () => {
    const found = validateContractValues(type, values);
    if (!client) found.client = true;
    if (!property) found.property = true;
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const advisor = advisors.find((a) => a.id === signerId);
      const content = buildContractContent(type, { client, property, advisor, values });
      await downloadContractPdf(content);
    } catch (err) {
      window.alert(err.message || t("contracts.error"));
    } finally {
      setBusy(false);
    }
  };

  const fieldControl = (field) => {
    const id = `contract-${field.key}`;
    const invalid = errors[field.key];
    const common = { id, "aria-invalid": Boolean(invalid) };
    if (field.type === "checkbox") {
      return (
        <label key={field.key} className="access-control__checkbox" style={{ alignSelf: "end" }}>
          <input type="checkbox" checked={Boolean(values[field.key])} onChange={(e) => setValue(field.key, e.target.checked)} />
          {t(`contracts.fields.${field.key}`)}
        </label>
      );
    }
    let control;
    if (field.type === "select") {
      control = (
        <select {...common} value={values[field.key] ?? ""} onChange={(e) => setValue(field.key, e.target.value)}>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {t(`contracts.options.${o}`)}
            </option>
          ))}
        </select>
      );
    } else if (field.type === "textarea") {
      control = <textarea {...common} rows={2} value={values[field.key] ?? ""} onChange={(e) => setValue(field.key, e.target.value)} />;
    } else {
      control = (
        <input
          {...common}
          type={field.type}
          min={field.type === "number" ? "0" : undefined}
          step={field.type === "number" ? "any" : undefined}
          value={values[field.key] ?? ""}
          onChange={(e) => setValue(field.key, e.target.value)}
        />
      );
    }
    return (
      <div className="form-field" key={field.key}>
        <label htmlFor={id}>
          {t(`contracts.fields.${field.key}`)}
          {field.required ? " *" : ""}
        </label>
        {control}
        {invalid && <span className="form-error">{t("contracts.required")}</span>}
      </div>
    );
  };

  return (
    <div className="card" style={{ padding: "1.25rem", marginTop: "2rem" }}>
      <h2 style={{ marginTop: 0 }}>{t("contracts.title")}</h2>
      <p className="form-hint">{t("contracts.subtitle")}</p>
      <p className="form-hint" style={{ color: "var(--color-danger)" }}>
        {t("contracts.disclaimer")}
      </p>

      <div className="form-field">
        <label htmlFor="contract-type">{t("contracts.docType")}</label>
        <select id="contract-type" value={type} onChange={(e) => changeType(e.target.value)}>
          {CONTRACT_DOC_TYPES.map((k) => (
            <option key={k} value={k}>
              {t(`contracts.types.${k}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label htmlFor="contract-client">{t(type === "autorizacion_venta" ? "contracts.owner" : "contracts.client")} *</label>
          <select id="contract-client" value={clientId} onChange={(e) => setClientId(e.target.value)} aria-invalid={Boolean(errors.client)}>
            <option value="">{t("contracts.choose")}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.client && <span className="form-error">{t("contracts.required")}</span>}
        </div>
        <div className="form-field">
          <label htmlFor="contract-property">{t("contracts.property")} *</label>
          <select id="contract-property" value={propertyId} onChange={(e) => changeProperty(e.target.value)} aria-invalid={Boolean(errors.property)}>
            <option value="">{t("contracts.choose")}</option>
            {sortedProperties.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.code, p.title].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
          {errors.property && <span className="form-error">{t("contracts.required")}</span>}
        </div>
      </div>

      {advisorId == null && (
        <div className="form-field">
          <label htmlFor="contract-signer">{t("contracts.advisor")}</label>
          <select id="contract-signer" value={signerId} onChange={(e) => setSignerId(e.target.value)}>
            <option value="">{t("contracts.noAdvisor")}</option>
            {advisors
              .filter((a) => a.active !== false)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </div>
      )}

      <div className="form-row" style={{ flexWrap: "wrap" }}>
        {CONTRACT_FIELDS[type].filter((f) => f.type !== "textarea").map(fieldControl)}
      </div>
      {CONTRACT_FIELDS[type].filter((f) => f.type === "textarea").map(fieldControl)}

      <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy}>
        {busy ? <span className="spinner" /> : null}
        {t("legalDocs.download")}
      </button>
    </div>
  );
}

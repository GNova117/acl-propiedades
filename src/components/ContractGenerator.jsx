import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { CONTRACT_DOC_TYPES, CONTRACT_FIELDS, buildContractContent, defaultContractValues, validateContractValues } from "../lib/contractDocs";
import { buildContractPdf, downloadContractPdf } from "../lib/contractPdf";
import SignatureModal from "./SignatureModal";
import SigningCredentials from "./SigningCredentials";
import { bytesToBase64 } from "../lib/signing";

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
  const [sigs, setSigs] = useState({}); // { client: { image, signedAt }, office: {...} }
  const [signing, setSigning] = useState(null); // "client" | "office" mientras el cuadro de firma está abierto
  const [credentials, setCredentials] = useState(null); // enlace y código de la solicitud de firma creada
  const [savedTo, setSavedTo] = useState(null); // id del cliente al que se guardó el PDF firmado

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

  // Valida y arma el contenido con las firmas que ya se hayan puesto.
  const prepareContent = () => {
    const found = validateContractValues(type, values);
    if (!client) found.client = true;
    if (!property) found.property = true;
    setErrors(found);
    if (Object.keys(found).length > 0) return null;
    const advisor = advisors.find((a) => a.id === signerId);
    const content = buildContractContent(type, { client, property, advisor, values });
    content.signatures = content.signatures.map((s) => ({ ...s, image: sigs[s.role]?.image, signedAt: sigs[s.role]?.signedAt }));
    return content;
  };

  const handleDownload = async () => {
    const content = prepareContent();
    if (!content) return;
    setBusy(true);
    try {
      await downloadContractPdf(content);
    } catch (err) {
      window.alert(err.message || t("contracts.error"));
    } finally {
      setBusy(false);
    }
  };

  // Crea una solicitud de firma para que el cliente firme desde el enlace. El
  // PDF va sin la firma del cliente (la pone él); si la oficina ya firmó aquí,
  // esa firma sí viaja.
  const handleSendToSign = async () => {
    const content = prepareContent();
    if (!content) return;
    content.signatures = content.signatures.map((s) => (s.role === "client" ? { ...s, image: undefined, signedAt: undefined } : s));
    setBusy(true);
    try {
      const bytes = await buildContractPdf(content);
      const title = `${t(`contracts.types.${type}`)} — ${property.title}`;
      const created = await db.createSigningRequest({
        clientId: client.id,
        propertyId: property.id,
        title,
        signerName: client.name,
        documentB64: bytesToBase64(bytes),
        expiresDays: 7,
      });
      setCredentials({ request: { ...created, title, signer_name: client.name }, phone: client.phone });
    } catch (err) {
      window.alert(err.message || t("contracts.sendError"));
    } finally {
      setBusy(false);
    }
  };

  // Guarda el PDF (con las firmas) en el expediente del cliente, como
  // documento de tipo "contrato".
  const handleSave = async () => {
    const content = prepareContent();
    if (!content) return;
    setBusy(true);
    try {
      const bytes = await buildContractPdf(content);
      const blob = new Blob([bytes], { type: "application/pdf" });
      await db.addClientDocument({ client_id: client.id, doc_type: "contrato", blob, quality_metrics: {} });
      setSavedTo(client.id);
    } catch (err) {
      window.alert(err.message || t("contracts.saveError"));
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

      <fieldset className="form-field" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-md, 10px)", padding: "0.9rem" }}>
        <legend style={{ padding: "0 0.4rem", fontWeight: 600 }}>{t("contracts.signaturesTitle")}</legend>
        <p className="form-hint" style={{ marginTop: 0 }}>{t("contracts.signaturesHint")}</p>
        {["client", "office"].map((role) => (
          <div key={role} style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <span style={{ minWidth: 150 }}>{t(`contracts.signer_${role}`)}</span>
            {sigs[role] ? (
              <img src={sigs[role].image} alt="" style={{ height: 40, background: "#fff", border: "1px solid var(--color-border)", borderRadius: 4, padding: 2 }} />
            ) : (
              <span className="form-hint">{t("contracts.unsigned")}</span>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setSigning(role)}>
              {sigs[role] ? t("contracts.resign") : t("contracts.sign")}
            </button>
            {sigs[role] && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSigs((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== role)))}
              >
                {t("contracts.removeSignature")}
              </button>
            )}
          </div>
        ))}
        <p className="form-hint" style={{ marginBottom: 0 }}>{t("contracts.signatureNote")}</p>
      </fieldset>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={busy}>
          {busy ? <span className="spinner" /> : null}
          {t("legalDocs.download")}
        </button>
        <button type="button" className="btn btn-outline" onClick={handleSave} disabled={busy}>
          {t("contracts.saveToFile")}
        </button>
        <button type="button" className="btn btn-outline" onClick={handleSendToSign} disabled={busy}>
          {t("contracts.sendToSign")}
        </button>
      </div>
      {credentials && (
        <div style={{ marginTop: "1rem" }}>
          <SigningCredentials request={credentials.request} phone={credentials.phone} onClose={() => setCredentials(null)} />
        </div>
      )}
      {savedTo && (
        <p className="form-hint" style={{ color: "var(--color-success)", marginTop: "0.75rem" }}>
          {t("contracts.saved")} <Link to={`/admin/clientes/${savedTo}/documentos`}>{t("contracts.openFile")}</Link>
        </p>
      )}

      {signing && (
        <SignatureModal
          title={t(`contracts.signer_${signing}`)}
          onCancel={() => setSigning(null)}
          onAccept={(sig) => {
            setSigs((prev) => ({ ...prev, [signing]: sig }));
            setSigning(null);
            setSavedTo(null);
          }}
        />
      )}
    </div>
  );
}

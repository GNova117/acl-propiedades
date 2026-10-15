import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { buildTemplateContent } from "../lib/documentTemplates";
import { downloadContractPdf } from "../lib/contractPdf";

// Generación de documentos a partir de una plantilla personalizada (creada
// en /admin/plantillas-documentos, sin tocar código). A diferencia de
// ContractGenerator (los 3 tipos fijos con firma en pantalla), esta primera
// versión solo llena los marcadores y descarga el PDF: no incluye captura
// de firma todavía.
export default function TemplateDocGenerator() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState([]);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [clientId, setClientId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [customValues, setCustomValues] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.getDocumentTemplates().then((data) => setTemplates(data.filter((tpl) => tpl.active)));
    db.getClients().then(setClients).catch(() => setClients([]));
    db.getProperties({}).then(setProperties).catch(() => setProperties([]));
    db.getAdvisors().then(setAdvisors).catch(() => setAdvisors([]));
  }, []);

  const template = useMemo(() => templates.find((tpl) => tpl.id === templateId) || null, [templates, templateId]);
  const client = useMemo(() => clients.find((c) => c.id === clientId) || null, [clients, clientId]);
  const property = useMemo(() => properties.find((p) => p.id === propertyId) || null, [properties, propertyId]);
  const advisor = useMemo(() => advisors.find((a) => a.id === advisorId) || null, [advisors, advisorId]);
  const sortedClients = useMemo(() => clients.slice().sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const sortedProperties = useMemo(() => properties.slice().sort((a, b) => a.title.localeCompare(b.title)), [properties]);

  const changeTemplate = (nextId) => {
    setTemplateId(nextId);
    setCustomValues({});
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!template) return;
    setBusy(true);
    try {
      const content = buildTemplateContent(template, { client, property, advisor, customValues });
      await downloadContractPdf(content);
    } catch (err) {
      window.alert(err.message || t("documentTemplates.generateError"));
    } finally {
      setBusy(false);
    }
  };

  if (templates.length === 0) {
    return (
      <div className="card admin-zone-card">
        <p className="form-hint">{t("documentTemplates.noneActive")}</p>
        <Link to="/admin/plantillas-documentos" className="btn btn-outline btn-sm">
          {t("documentTemplates.manage")}
        </Link>
      </div>
    );
  }

  return (
    <form className="card admin-form" onSubmit={handleGenerate} noValidate style={{ maxWidth: 720 }}>
      <div className="form-field">
        <label htmlFor="tdg-template">{t("documentTemplates.fields.template")}</label>
        <select id="tdg-template" value={templateId} onChange={(e) => changeTemplate(e.target.value)}>
          <option value="">—</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {tpl.name}
            </option>
          ))}
        </select>
      </div>

      {template && (
        <>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="tdg-client">{t("contracts.client")}</label>
              <select id="tdg-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">—</option>
                {sortedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="tdg-property">{t("salesReports.table.property")}</label>
              <select id="tdg-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                <option value="">—</option>
                {sortedProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="tdg-advisor">{t("salesReports.table.advisor")}</label>
              <select id="tdg-advisor" value={advisorId} onChange={(e) => setAdvisorId(e.target.value)}>
                <option value="">—</option>
                {advisors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(template.custom_fields || []).map((cf) => (
            <div className="form-field" key={cf.key}>
              <label htmlFor={`tdg-field-${cf.key}`}>{cf.label}</label>
              <input
                id={`tdg-field-${cf.key}`}
                type={cf.type === "number" ? "number" : cf.type === "date" ? "date" : "text"}
                value={customValues[cf.key] || ""}
                onChange={(e) => setCustomValues((prev) => ({ ...prev, [cf.key]: e.target.value }))}
              />
            </div>
          ))}

          <div className="admin-form__actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <span className="spinner" /> : null}
              {t("documentTemplates.generate")}
            </button>
          </div>
        </>
      )}
    </form>
  );
}

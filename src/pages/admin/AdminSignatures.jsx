import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { useAuth } from "../../context/AuthContext";
import SigningCredentials from "../../components/SigningCredentials";
import { SIGNING_MAX_PDF_BYTES, effectiveStatus, fileToBase64, imageFileToFingerprintPng, signingAgeDays, signingLink, signingReminderText } from "../../lib/signing";
import { whatsappDigits } from "../../lib/format";
import { buildSignedPdf, downloadSignedPdf } from "../../lib/signedPdf";
import "./admin.css";

const STATUS_CLASS = { pendiente: "badge-reserved", firmado: "badge-available", cancelado: "badge-sold", expirado: "badge-sold", bloqueado: "badge-sold" };

// Firmas de contratos: el personal sube un PDF (o lo manda desde el generador de
// documentos), le da al cliente un enlace privado y un código, y aquí ve quién ya
// firmó, agrega la huella capturada con el lector y descarga el PDF firmado.
export default function AdminSignatures() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ clientId: "", signerName: "", title: "", propertyId: "", days: "7" });
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState(null); // { request, phone }
  const [busyId, setBusyId] = useState(null);
  const [fingerprintFor, setFingerprintFor] = useState(null); // solicitud a la que se le agrega la huella
  const [fingerprintPreview, setFingerprintPreview] = useState("");
  const fileInput = useRef(null);

  const load = () => {
    setLoading(true);
    Promise.all([db.getSigningRequests(), db.getClients().catch(() => []), db.getProperties({}).catch(() => [])])
      .then(([reqs, cls, props]) => {
        setRequests(reqs);
        setClients(cls);
        setProperties(props);
        setError("");
      })
      .catch((err) => setError(err.message || t("signing.admin.loadError")))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const chooseClient = (e) => {
    const id = e.target.value;
    setForm((prev) => ({ ...prev, clientId: id, signerName: clientById[id]?.name || prev.signerName }));
  };

  const chooseFile = (e) => {
    const picked = e.target.files?.[0] || null;
    setFile(picked);
    if (picked && !form.title.trim()) setForm((prev) => ({ ...prev, title: picked.name.replace(/\.pdf$/i, "") }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.clientId || !form.signerName.trim() || !form.title.trim() || !file) {
      setFormError(t("signing.admin.formRequired"));
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setFormError(t("signing.admin.onlyPdf"));
      return;
    }
    if (file.size > SIGNING_MAX_PDF_BYTES) {
      setFormError(t("signing.admin.tooBig", { mb: SIGNING_MAX_PDF_BYTES / 1048576 }));
      return;
    }
    setCreating(true);
    try {
      const created = await db.createSigningRequest({
        clientId: form.clientId,
        propertyId: form.propertyId || null,
        title: form.title.trim(),
        signerName: form.signerName.trim(),
        documentB64: await fileToBase64(file),
        expiresDays: Number(form.days) || 7,
      });
      setCredentials({ request: { ...created, title: form.title.trim(), signer_name: form.signerName.trim() }, phone: clientById[form.clientId]?.phone });
      setShowForm(false);
      setForm({ clientId: "", signerName: "", title: "", propertyId: "", days: "7" });
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      load();
    } catch (err) {
      setFormError(err.message || t("signing.admin.createError"));
    } finally {
      setCreating(false);
    }
  };

  const run = async (id, action, fallback) => {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      window.alert(err.message || fallback);
    } finally {
      setBusyId(null);
    }
  };

  const regenerate = (r) =>
    run(r.id, async () => {
      const { code } = await db.regenerateSigningCode(r.id);
      setCredentials({ request: { token: r.token, code, title: r.title, signer_name: r.signer_name }, phone: clientById[r.client_id]?.phone });
      load();
    }, t("signing.admin.actionError"));

  const cancel = (r) => {
    if (!window.confirm(t("signing.admin.confirmCancel"))) return;
    return run(r.id, async () => {
      await db.updateSigningRequest(r.id, { status: "cancelado" });
      load();
    }, t("signing.admin.actionError"));
  };

  const remove = (r) => {
    if (!window.confirm(t("signing.admin.confirmDelete"))) return;
    return run(r.id, async () => {
      await db.deleteSigningRequest(r.id);
      load();
    }, t("signing.admin.actionError"));
  };

  // Recordatorio por WhatsApp al cliente (solo el enlace, nunca el código).
  const remind = (r) => {
    let digits = whatsappDigits(clientById[r.client_id]?.phone);
    if (digits.length === 10) digits = `52${digits}`;
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(signingReminderText(r))}`, "_blank", "noopener,noreferrer");
  };

  const download = (r) =>
    run(r.id, async () => {
      const full = await db.getSigningRequestFull(r.id);
      await downloadSignedPdf(full);
    }, t("signing.admin.actionError"));

  const saveToFile = (r) =>
    run(r.id, async () => {
      const full = await db.getSigningRequestFull(r.id);
      const bytes = await buildSignedPdf(full);
      const blob = new Blob([bytes], { type: "application/pdf" });
      await db.addClientDocument({ client_id: r.client_id, doc_type: "contrato", blob, quality_metrics: {} });
      await db.updateSigningRequest(r.id, { sealed_at: new Date().toISOString() });
      load();
      window.alert(t("signing.admin.savedToFile"));
    }, t("signing.admin.actionError"));

  // ── Huella ──
  const startFingerprint = (r) => {
    setFingerprintFor(r);
    setFingerprintPreview("");
  };

  const loadFingerprintImage = async (imageFile) => {
    try {
      setFingerprintPreview(await imageFileToFingerprintPng(imageFile));
    } catch {
      window.alert(t("signing.admin.badImage"));
    }
  };

  // Ctrl+V con la imagen copiada desde el programa del lector.
  useEffect(() => {
    if (!fingerprintFor) return undefined;
    const onPaste = (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
      if (item) loadFingerprintImage(item.getAsFile());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprintFor]);

  const saveFingerprint = () =>
    run(fingerprintFor.id, async () => {
      const email = session?.user?.email || "demo";
      await db.updateSigningRequest(fingerprintFor.id, {
        fingerprint_b64: fingerprintPreview,
        fingerprint_by: email,
        fingerprint_at: new Date().toISOString(),
      });
      setFingerprintFor(null);
      setFingerprintPreview("");
      load();
    }, t("signing.admin.actionError"));

  const fmt = (iso) => (iso ? new Date(iso).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("signing.admin.title")}</h1>
          <p className="form-hint">{t("signing.admin.subtitle")}</p>
        </div>
        <div className="admin-header__actions">
          <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {t("signing.admin.new")}
          </button>
        </div>
      </div>

      <p className="form-hint" style={{ color: "var(--color-danger)" }}>
        {t("signing.admin.legalNote")}
      </p>

      {credentials && <SigningCredentials request={credentials.request} phone={credentials.phone} onClose={() => setCredentials(null)} />}

      {showForm && (
        <form className="card admin-form" onSubmit={handleCreate} noValidate style={{ marginBottom: "1.5rem" }}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="sg-client">{t("signing.admin.client")} *</label>
              <select id="sg-client" value={form.clientId} onChange={chooseClient}>
                <option value="">{t("signing.admin.choose")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="sg-signer">{t("signing.admin.signerName")} *</label>
              <input id="sg-signer" value={form.signerName} onChange={setField("signerName")} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="sg-title">{t("signing.admin.docTitle")} *</label>
            <input id="sg-title" value={form.title} onChange={setField("title")} placeholder={t("signing.admin.docTitlePlaceholder")} />
          </div>
          <div className="form-field">
            <label htmlFor="sg-file">{t("signing.admin.pdf")} *</label>
            <input id="sg-file" ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={chooseFile} />
            <span className="form-hint">{t("signing.admin.pdfHint", { mb: SIGNING_MAX_PDF_BYTES / 1048576 })}</span>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="sg-property">{t("signing.admin.property")}</label>
              <select id="sg-property" value={form.propertyId} onChange={setField("propertyId")}>
                <option value="">{t("signing.admin.none")}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.code, p.title].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="sg-days">{t("signing.admin.validity")}</label>
              <input id="sg-days" type="number" min="1" max="60" value={form.days} onChange={setField("days")} />
            </div>
          </div>
          {formError && <span className="form-error">{formError}</span>}
          <div className="admin-form__actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? <span className="spinner" /> : null}
              {t("signing.admin.create")}
            </button>
          </div>
        </form>
      )}

      {fingerprintFor && (
        <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginTop: 0 }}>{t("signing.admin.fingerprintTitle", { title: fingerprintFor.title })}</h3>
          <p className="form-hint">{t("signing.admin.fingerprintHint")}</p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && loadFingerprintImage(e.target.files[0])} />
            {fingerprintPreview && (
              <img src={`data:image/png;base64,${fingerprintPreview}`} alt={t("signing.admin.fingerprintPreview")} style={{ height: 96, background: "#fff", border: "1px solid var(--color-border)", borderRadius: 6 }} />
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className="btn btn-primary btn-sm" disabled={!fingerprintPreview || busyId === fingerprintFor.id} onClick={saveFingerprint}>
              {t("signing.admin.fingerprintSave")}
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setFingerprintFor(null)}>
              {t("common.cancel")}
            </button>
          </div>
          <p className="form-hint" style={{ marginBottom: 0, marginTop: "0.75rem" }}>
            {t("signing.admin.fingerprintNote")}
          </p>
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="card admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t("signing.admin.colDocument")}</th>
              <th>{t("signing.admin.colClient")}</th>
              <th>{t("common.status")}</th>
              <th>{t("signing.admin.colDates")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5}>{t("common.loading")}</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5}>{t("signing.admin.empty")}</td>
              </tr>
            ) : (
              requests.map((r) => {
                const status = effectiveStatus(r);
                return (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "normal", maxWidth: 260 }}>
                      <strong>{r.title}</strong>
                      <span className="form-hint" style={{ display: "block", margin: 0 }}>
                        {r.signer_name}
                      </span>
                    </td>
                    <td>{clientById[r.client_id]?.name || "—"}</td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[status] || ""}`}>{t(`signing.status.${status}`)}</span>
                      {status === "pendiente" && signingAgeDays(r) >= 3 && (
                        <span className="form-error" style={{ display: "block", margin: 0, fontSize: "0.78rem" }}>
                          {t("signing.admin.waiting", { count: signingAgeDays(r) })}
                        </span>
                      )}
                      {r.fingerprint_at && <span className="form-hint" style={{ display: "block", margin: 0 }}>{t("signing.admin.withFingerprint")}</span>}
                    </td>
                    <td className="form-hint" style={{ whiteSpace: "normal" }}>
                      {status === "firmado" ? (
                        <>
                          {t("signing.admin.signedAt")}: {fmt(r.signed_at)}
                          {r.signer_ip ? <span style={{ display: "block" }}>IP {r.signer_ip}</span> : null}
                        </>
                      ) : (
                        <>
                          {t("signing.admin.createdAt")}: {fmt(r.created_at)}
                          <span style={{ display: "block" }}>
                            {t("signing.admin.expiresAt")}: {fmt(r.expires_at)}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="admin-table__actions">
                      {status === "firmado" && (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => download(r)} disabled={busyId === r.id}>
                            {t("signing.admin.downloadSigned")}
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => startFingerprint(r)}>
                            {r.fingerprint_at ? t("signing.admin.replaceFingerprint") : t("signing.admin.addFingerprint")}
                          </button>
                          {r.client_id && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => saveToFile(r)} disabled={busyId === r.id}>
                              {r.sealed_at ? t("signing.admin.savedAgain") : t("signing.admin.saveToFile")}
                            </button>
                          )}
                        </>
                      )}
                      {(status === "pendiente" || status === "bloqueado" || status === "expirado") && (
                        <>
                          {status !== "expirado" && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(signingLink(r.token))}>
                              {t("signing.credentials.copyLink")}
                            </button>
                          )}
                          {status === "pendiente" && (
                            <button type="button" className={`btn btn-sm ${signingAgeDays(r) >= 3 ? "btn-primary" : "btn-outline"}`} onClick={() => remind(r)}>
                              {t("signing.admin.remind")}
                            </button>
                          )}
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => regenerate(r)} disabled={busyId === r.id}>
                            {t("signing.admin.newCode")}
                          </button>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => cancel(r)} disabled={busyId === r.id}>
                            {t("signing.admin.cancel")}
                          </button>
                        </>
                      )}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(r)} disabled={busyId === r.id}>
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


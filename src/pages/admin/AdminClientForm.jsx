import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { CLIENT_TYPES, FINANCIAMIENTO_TYPES } from "../../lib/format";
import { CLIENT_EXPEDIENTE_KEYS, clientExpedienteGroups, clientSheetData, clientSheetSections, missingRequiredClient, requiredClientKeys } from "../../lib/clientExpedienteFields";
import { downloadMultiPerfilamientoPdf } from "../../lib/perfilamientoPdf";
import InternalNotes from "../../components/InternalNotes";
import "./admin.css";
import LoadingState from "../../components/LoadingState";
import { confirmDialog, notify } from "../../lib/toast";
import { notifyLoadError } from "../../lib/loadError";
import { useUnsavedChanges } from "../../lib/useUnsavedChanges";

// Mismos tipos que soporta el perfilamiento (ver FieldInput en
// PerfilamientoManager.jsx). Un campo sensible (la contraseña del portal de
// crédito) se muestra oculto y trae un botón para verla; cada vez que se abre
// la pantalla vuelve a empezar oculto.
function ExpedienteFieldInput({ field, value, onChange, required = false, invalid = false }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const common = {
    id: `c-${field.key}`,
    value,
    onChange,
    "aria-required": required || undefined,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `c-${field.key}-error` : undefined,
  };
  if (field.sensitive) {
    const label = t(revealed ? "clients.hidePassword" : "clients.showPassword");
    return (
      <div className="sensitive-input">
        <input {...common} type={revealed ? "text" : "password"} autoComplete="off" />
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setRevealed((v) => !v)} aria-pressed={revealed} aria-label={label} title={label}>
          <span aria-hidden="true">{revealed ? "🙈" : "👁"}</span>
        </button>
      </div>
    );
  }
  if (field.type === "textarea") return <textarea {...common} rows={3} />;
  if (field.type === "select") {
    return (
      <select {...common}>
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "date") return <input {...common} type="date" />;
  if (field.type === "email") return <input {...common} type="email" />;
  if (field.type === "tel") return <input {...common} type="tel" />;
  return <input {...common} type="text" />;
}

const EMPTY = {
  name: "",
  type: "comprador",
  email: "",
  phone: "",
  notes: "",
  active: true,
  financiamiento: "",
  ...Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, ""])),
};

export default function AdminClientForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // "Crear cliente" desde un mensaje de contacto (/admin/mensajes) llega
  // aquí con state.prefill — nombre/teléfono/correo ya capturados por la
  // persona, no hace falta volver a teclearlos. Solo aplica al crear, no
  // al editar un cliente ya existente.
  const [form, setForm] = useState(() => (!isEdit && location.state?.prefill ? { ...EMPTY, ...location.state.prefill } : EMPTY));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  // Cerrar la pestaña con cambios sin guardar pide confirmar.
  useUnsavedChanges(form, { ready: !loading, enabled: !saving });
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Vínculo con otro cliente (expediente conjunto) — ej. una pareja que
  // junta su crédito INFONAVIT y aplica como 2 acreditados. `otherClients`
  // alimenta el selector; `link` es el vínculo ya guardado (si lo hay,
  // solo aplica editando un cliente existente); `linkTargetId`/`linkLabel`
  // son la selección pendiente de guardar (funciona también al crear un
  // cliente nuevo — el vínculo se crea justo después de guardarlo).
  const [otherClients, setOtherClients] = useState([]);
  const [link, setLink] = useState(null);
  const [linkTargetId, setLinkTargetId] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    db.getClientById(id).then((client) => {
      if (!client) return;
      setForm({
        name: client.name,
        type: client.type,
        email: client.email || "",
        phone: client.phone || "",
        notes: client.notes || "",
        active: client.active !== false,
        financiamiento: client.financiamiento || "",
        ...Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, client[key] || ""])),
      });
      setLoading(false);
    }).catch((err) => { notifyLoadError(err); setLoading(false); });
    db.getClientLink(id).then(setLink).catch(notifyLoadError);
  }, [id, isEdit]);

  useEffect(() => {
    db.getClients().then((data) => setOtherClients(data.filter((c) => c.id !== id))).catch(notifyLoadError);
  }, [id]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Para los campos del expediente marcados `uppercase` (identificación del
  // derechohabiente, igual que en el formato oficial impreso): se escribe
  // tal cual lo tecleado, pero se guarda en mayúsculas.
  const handleExpedienteFieldChange = (field) => (e) => {
    const value = field.uppercase ? e.target.value.toUpperCase() : e.target.value;
    setForm((prev) => ({ ...prev, [field.key]: value }));
  };

  // Ficha con lo que ya está en pantalla (nombre, tipo, teléfono, correo,
  // notas y los datos del expediente según el tipo — vendedor:
  // domicilio/RFC/CURP/número de crédito; comprador: eso mismo más NSS,
  // contraseña del portal, empresa y referencias). Si el cliente tiene un
  // vinculado (expediente conjunto, ej. crédito INFONAVIT conyugal), su
  // ficha se agrega al mismo PDF — ya no hay que descargarlas por separado.
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const entries = [{ data: clientSheetData(form), sections: clientSheetSections(form), options: { title: "DATOS DEL CLIENTE" }, nombre: form.name }];
      if (link?.other_client) {
        entries.push({
          data: clientSheetData(link.other_client),
          sections: clientSheetSections(link.other_client),
          options: { title: "DATOS DEL CLIENTE" },
          nombre: link.other_client.name,
        });
      }
      await downloadMultiPerfilamientoPdf(entries, "Cliente");
    } catch (err) {
      notify(err.message || "Error al generar el PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const validate = () => {
    const next = {};
    // Obligatorios: nombre, teléfono, correo y datos personales; con INFONAVIT además NSS y contraseña del portal
    // (comprador) y número de crédito (vendedor). Ver requiredClientKeys.
    for (const key of missingRequiredClient(form)) next[key] = t("contact.required");
    setErrors(next);
    // El primer campo con error recibe el foco, para que no haya que buscarlo en un formulario largo.
    const first = Object.keys(next)[0];
    if (first) setTimeout(() => document.getElementById(first === "name" ? "c-name" : `c-${first}`)?.focus(), 0);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await db.updateClient(id, form);
      } else {
        const created = await db.addClient(form);
        // El cliente recién creado también puede vincularse de una vez si
        // ya se eligió con quién, sin necesidad de guardar y volver a
        // entrar a editarlo.
        if (linkTargetId) await db.linkClients(created.id, linkTargetId, linkLabel);
      }
      navigate("/admin/clientes");
    } catch (err) {
      notify(err.message || t("common.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!linkTargetId) return;
    setLinkBusy(true);
    try {
      const targetAlreadyLinked = await db.getClientLink(linkTargetId);
      if (targetAlreadyLinked) {
        notify(t("clients.linkTargetAlreadyLinked", { name: targetAlreadyLinked.other_client?.name || targetAlreadyLinked.client_a_id }));
        return;
      }
      const created = await db.linkClients(id, linkTargetId, linkLabel);
      const other = otherClients.find((c) => c.id === linkTargetId);
      setLink({ ...created, other_client: other });
      setLinkTargetId("");
      setLinkLabel("");
    } catch (err) {
      notify(err.message || "Error al vincular");
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!link || !await confirmDialog(t("clients.confirmUnlink"))) return;
    setLinkBusy(true);
    try {
      await db.unlinkClients(link.id);
      setLink(null);
    } catch (err) {
      notify(err.message || "Error al quitar el vínculo");
    } finally {
      setLinkBusy(false);
    }
  };

  const requiredKeys = requiredClientKeys(form);
  const isRequired = (key) => requiredKeys.includes(key);
  // Etiqueta con * y mensaje de error de un campo obligatorio (los mismos ids que usa validate para enfocar).
  const labelOf = (key, text) => (
    <label htmlFor={`c-${key}`}>
      {text}
      {isRequired(key) && <span aria-hidden="true"> *</span>}
    </label>
  );
  const errorOf = (key) => errors[key] && <span className="form-error" id={`c-${key}-error`}>{errors[key]}</span>;
  const a11yOf = (key) => ({ "aria-required": isRequired(key) || undefined, "aria-invalid": errors[key] ? true : undefined, "aria-describedby": errors[key] ? `c-${key}-error` : undefined });
  // Un campo del expediente (personal o de crédito) con su etiqueta, entrada y error.
  const renderExpedienteField = (field) => (
    <div className="form-field" key={field.key} style={field.full ? { gridColumn: "1 / -1" } : undefined}>
      {labelOf(field.key, field.label)}
      <ExpedienteFieldInput field={field} value={form[field.key]} onChange={handleExpedienteFieldChange(field)} required={isRequired(field.key)} invalid={Boolean(errors[field.key])} />
      {errorOf(field.key)}
    </div>
  );

  if (loading) return <LoadingState />;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("admin.editClient") : t("admin.newClient")}</h1>
        {isEdit && (
          <div className="admin-header__actions">
            <button type="button" className="btn btn-outline" onClick={handleDownloadPdf} disabled={downloadingPdf}>
              {downloadingPdf ? <span className="spinner" /> : null}
              {t("clients.downloadPdf")}
            </button>
            <Link to={`/admin/clientes/${id}/perfilamiento`} className="btn btn-outline">
              {t("profiling.title")}
            </Link>
            <Link to={`/admin/clientes/${id}/documentos`} className="btn btn-outline">
              {t("clients.viewDocuments")}
            </Link>
            {form.financiamiento === "infonavit" && (
              <>
                <Link to="/admin/solicitud-avaluo" state={{ prefillClienteId: id }} className="btn btn-outline">
                  {t("solicitudAvaluo.navTitle")}
                </Link>
                <Link to="/admin/solicitud-credito" state={{ prefillClienteId: id }} className="btn btn-outline">
                  {t("solicitudCredito.navTitle")}
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <p className="form-hint mt-0">{t("clients.requiredHint")}</p>
        <div className="form-row">
          <div className="form-field">
            {labelOf("name", t("clients.name"))}
            <input id="c-name" value={form.name} onChange={handleChange("name")} {...a11yOf("name")} />
            {errorOf("name")}
          </div>
          <div className="form-field">
            <label htmlFor="c-type">{t("clients.type")}</label>
            <select id="c-type" value={form.type} onChange={handleChange("type")}>
              {CLIENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`clients.${type === "comprador" ? "buyer" : type === "vendedor" ? "seller" : "both"}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            {labelOf("phone", t("clients.phone"))}
            <input id="c-phone" value={form.phone} onChange={handleChange("phone")} {...a11yOf("phone")} />
            {errorOf("phone")}
          </div>
          <div className="form-field">
            {labelOf("email", t("clients.email"))}
            <input id="c-email" type="email" value={form.email} onChange={handleChange("email")} {...a11yOf("email")} />
            {errorOf("email")}
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="c-financiamiento">{t("clients.financiamiento")}</label>
            <select id="c-financiamiento" value={form.financiamiento} onChange={handleChange("financiamiento")}>
              <option value="">—</option>
              {FINANCIAMIENTO_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`clients.financiamientoOptions.${value}`)}
                </option>
              ))}
            </select>
            <span className="form-hint">{t("clients.financiamientoHint")}</span>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="c-notes">{t("clients.notes")}</label>
          <textarea id="c-notes" rows={3} value={form.notes} onChange={handleChange("notes")} />
        </div>

        {/* "Datos personales" (fecha de nacimiento, estado civil, domicilio, RFC, CURP,
            identificación oficial) aplica a cualquier cliente — precarga su perfilamiento
            (comprador o vendedor) sin importar el financiamiento, así que va siempre visible. */}
        {clientExpedienteGroups(form.type)
          .filter((group) => group.key === "personal")
          .map((group) => (
            <div key={group.key}>
              <h4 style={{ margin: "0 0 0.5rem" }}>{group.title}</h4>
              <div className="form-row">
                {group.fields.map(renderExpedienteField)}
              </div>
            </div>
          ))}

        {form.financiamiento === "infonavit" && (
          <>
            <h3 style={{ margin: "0.5rem 0 0" }}>{t("clients.expedienteSection")}</h3>
            <p className="form-hint mt-n2">{t("clients.expedienteSectionHint")}</p>
            <p className="form-hint mt-n2">{t("clients.requiredCreditHint")}</p>
            {clientExpedienteGroups(form.type)
              .filter((group) => group.key !== "personal")
              .map((group) => (
                <div key={group.key}>
                  <h4 style={{ margin: "0 0 0.5rem" }}>{group.title}</h4>
                  <div className="form-row">
                    {group.fields.map(renderExpedienteField)}
                  </div>
                </div>
              ))}
          </>
        )}
        {form.financiamiento !== "infonavit" && <p className="form-hint">{t("clients.expedienteSectionHiddenHint")}</p>}

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.active} onChange={handleChange("active")} className="mr-2" />
            {t("common.active")}
          </label>
        </div>

        <div className="admin-form__actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <span className="spinner" /> : null}
            {t("common.save")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate("/admin/clientes")}>
            {t("common.cancel")}
          </button>
        </div>
      </form>

      <div className="card admin-form mt-5">
        <h3 className="mt-0">{t("clients.jointTitle")}</h3>
        <p className="form-hint mt-n2">{t("clients.jointSubtitle")}</p>

        {link ? (
          <>
            <p>
              {t("clients.linkedWith")} <strong>{link.other_client?.name || "—"}</strong>
              {link.label ? ` · ${link.label}` : ""}
            </p>
            <div className="admin-form__actions">
              {isEdit && (
                <Link to={`/admin/clientes/${id}/conjunto`} className="btn btn-primary btn-sm">
                  {t("clients.viewJoint")}
                </Link>
              )}
              <button type="button" className="btn btn-danger btn-sm" onClick={handleUnlink} disabled={linkBusy}>
                {t("clients.unlink")}
              </button>
            </div>
          </>
        ) : (
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="c-link-target">{t("clients.linkWith")}</label>
              <select id="c-link-target" value={linkTargetId} onChange={(e) => setLinkTargetId(e.target.value)}>
                <option value="">—</option>
                {otherClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="c-link-label">{t("clients.linkReason")}</label>
              <input
                id="c-link-label"
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder={t("clients.linkReasonPlaceholder")}
              />
            </div>
            {isEdit ? (
              <div className="form-field" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-outline" onClick={handleLink} disabled={!linkTargetId || linkBusy}>
                  {t("clients.linkNow")}
                </button>
              </div>
            ) : (
              linkTargetId && <p className="form-hint" style={{ alignSelf: "center" }}>{t("clients.linkOnSave")}</p>
            )}
          </div>
        )}
      </div>

      {isEdit && <InternalNotes entityType="client" entityId={id} />}
    </div>
  );
}

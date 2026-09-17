import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { CLIENT_TYPES } from "../../lib/format";
import { CLIENT_EXPEDIENTE_KEYS, clientExpedienteGroups } from "../../lib/clientExpedienteFields";
import "./admin.css";

const EMPTY = {
  name: "",
  type: "comprador",
  email: "",
  phone: "",
  notes: "",
  active: true,
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
        ...Object.fromEntries(CLIENT_EXPEDIENTE_KEYS.map((key) => [key, client[key] || ""])),
      });
      setLoading(false);
    });
    db.getClientLink(id).then(setLink);
  }, [id, isEdit]);

  useEffect(() => {
    db.getClients().then((data) => setOtherClients(data.filter((c) => c.id !== id)));
  }, [id]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = t("contact.required");
    setErrors(next);
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
      window.alert(err.message || "Error al guardar");
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
        window.alert(t("clients.linkTargetAlreadyLinked", { name: targetAlreadyLinked.other_client?.name || targetAlreadyLinked.client_a_id }));
        return;
      }
      const created = await db.linkClients(id, linkTargetId, linkLabel);
      const other = otherClients.find((c) => c.id === linkTargetId);
      setLink({ ...created, other_client: other });
      setLinkTargetId("");
      setLinkLabel("");
    } catch (err) {
      window.alert(err.message || "Error al vincular");
    } finally {
      setLinkBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!link || !window.confirm(t("clients.confirmUnlink"))) return;
    setLinkBusy(true);
    try {
      await db.unlinkClients(link.id);
      setLink(null);
    } catch (err) {
      window.alert(err.message || "Error al quitar el vínculo");
    } finally {
      setLinkBusy(false);
    }
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>{isEdit ? t("admin.editClient") : t("admin.newClient")}</h1>
        {isEdit && (
          <div className="admin-header__actions">
            <Link to={`/admin/clientes/${id}/perfilamiento`} className="btn btn-outline">
              {t("profiling.title")}
            </Link>
            <Link to={`/admin/clientes/${id}/documentos`} className="btn btn-outline">
              {t("clients.viewDocuments")}
            </Link>
          </div>
        )}
      </div>

      <form className="card admin-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="c-name">{t("clients.name")}</label>
            <input id="c-name" value={form.name} onChange={handleChange("name")} />
            {errors.name && <span className="form-error">{errors.name}</span>}
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
            <label htmlFor="c-phone">{t("clients.phone")}</label>
            <input id="c-phone" value={form.phone} onChange={handleChange("phone")} />
          </div>
          <div className="form-field">
            <label htmlFor="c-email">{t("clients.email")}</label>
            <input id="c-email" type="email" value={form.email} onChange={handleChange("email")} />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="c-notes">{t("clients.notes")}</label>
          <textarea id="c-notes" rows={3} value={form.notes} onChange={handleChange("notes")} />
        </div>

        <h3 style={{ margin: "0.5rem 0 0" }}>{t("clients.expedienteSection")}</h3>
        <p className="form-hint" style={{ marginTop: "-0.5rem" }}>{t("clients.expedienteSectionHint")}</p>
        {clientExpedienteGroups(form.type).map((group) => (
          <div key={group.key}>
            <h4 style={{ margin: "0 0 0.5rem" }}>{group.title}</h4>
            <div className="form-row">
              {group.fields.map((field) => (
                <div className="form-field" key={field.key} style={field.full ? { gridColumn: "1 / -1" } : undefined}>
                  <label htmlFor={`c-${field.key}`}>{field.label}</label>
                  <input
                    id={`c-${field.key}`}
                    type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
                    value={form[field.key]}
                    onChange={handleChange(field.key)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="form-field">
          <label>
            <input type="checkbox" checked={form.active} onChange={handleChange("active")} style={{ marginRight: "0.5rem" }} />
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

      <div className="card admin-form" style={{ marginTop: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>{t("clients.jointTitle")}</h3>
        <p className="form-hint" style={{ marginTop: "-0.5rem" }}>{t("clients.jointSubtitle")}</p>

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
    </div>
  );
}

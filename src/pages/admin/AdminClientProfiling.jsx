import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import {
  VENDEDOR_FIELDS,
  INMUEBLE_FIELDS,
  EMPTY_PERFILAMIENTO,
  UPPERCASE_FIELDS,
  validatePerfilamiento,
  isFieldVisible,
  displayValue,
  formatFecha,
} from "../../lib/perfilamiento";
import { downloadPerfilamientoPdf } from "../../lib/perfilamientoPdf";
import "./AdminClientProfiling.css";
import "./admin.css";

function FieldInput({ field, value, error, onChange }) {
  const id = `perf-${field.key}`;
  const common = {
    id,
    value: value ?? "",
    onChange: (e) => onChange(field.key, e.target.value),
    "aria-invalid": error ? "true" : undefined,
  };

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
  if (field.type === "number") return <input {...common} type="number" min="0" step="0.01" />;
  if (field.type === "integer") return <input {...common} type="number" min="0" step="1" />;
  if (field.type === "email") return <input {...common} type="email" />;
  if (field.type === "tel") return <input {...common} type="tel" inputMode="numeric" maxLength={10} />;
  return <input {...common} type="text" />;
}

function FieldGroup({ fields, form, errors, onChange }) {
  return (
    <div className="profiling-grid">
      {fields.map((field) => {
        if (!isFieldVisible(field, form)) return null;
        return (
          <div
            key={field.key}
            className={`form-field profiling-grid__item${field.full ? " profiling-grid__item--full" : ""}`}
          >
            <label htmlFor={`perf-${field.key}`}>
              {field.label}
              {field.required && <span className="profiling-required"> *</span>}
            </label>
            <FieldInput field={field} value={form[field.key]} error={errors[field.key]} onChange={onChange} />
            {errors[field.key] && <span className="form-error">{errors[field.key]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ReadSection({ fields, perfilamiento }) {
  const visible = fields.filter((field) => isFieldVisible(field, perfilamiento) && displayValue(field, perfilamiento));
  if (visible.length === 0) return <p className="form-hint">—</p>;
  return (
    <dl className="profiling-read">
      {visible.map((field) => (
        <div key={field.key} className="profiling-read__row">
          <dt>{field.label}</dt>
          <dd>{displayValue(field, perfilamiento)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AdminClientProfiling() {
  const { id } = useParams();
  const { t } = useTranslation();

  const [client, setClient] = useState(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("list"); // list | form | read
  const [current, setCurrent] = useState(null); // perfilamiento completo en lectura/edición
  const [form, setForm] = useState(EMPTY_PERFILAMIENTO);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyPdfId, setBusyPdfId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([db.getClientById(id), db.getPerfilamientos(id)]).then(([clientData, perfilamientos]) => {
      setClient(clientData);
      setList(perfilamientos);
      setLoading(false);
    });
  };

  useEffect(load, [id]);

  const handleChange = (key, rawValue) => {
    let value = rawValue;
    if (UPPERCASE_FIELDS.includes(key)) value = value.toUpperCase();
    if (key === "telefono") value = value.replace(/\D/g, "").slice(0, 10);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startNew = () => {
    setCurrent(null);
    setForm(EMPTY_PERFILAMIENTO);
    setErrors({});
    setMode("form");
  };

  const openPerfilamiento = async (perfilamientoId) => {
    const full = await db.getPerfilamientoById(perfilamientoId);
    if (!full) return;
    setCurrent(full);
    setMode("read");
  };

  const startEdit = () => {
    setForm({ ...EMPTY_PERFILAMIENTO, ...toFormValues(current) });
    setErrors({});
    setMode("form");
  };

  const save = async ({ withPdf }) => {
    const nextErrors = validatePerfilamiento(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const saved = current
        ? await db.updatePerfilamiento(current.id, form)
        : await db.addPerfilamiento(id, form);
      const full = (await db.getPerfilamientoById(saved.id)) || saved;
      setCurrent(full);
      setMode("read");
      load();
      if (withPdf) await downloadPerfilamientoPdf(full);
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const downloadById = async (perfilamientoId) => {
    setBusyPdfId(perfilamientoId);
    try {
      const full = await db.getPerfilamientoById(perfilamientoId);
      if (full) await downloadPerfilamientoPdf(full);
    } catch (err) {
      window.alert(err.message || "Error al generar el PDF");
    } finally {
      setBusyPdfId(null);
    }
  };

  const handleDelete = async (perfilamientoId) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deletePerfilamiento(perfilamientoId);
    if (current?.id === perfilamientoId) {
      setCurrent(null);
      setMode("list");
    }
    load();
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1>{t("profiling.title")}</h1>
          <p className="form-hint">{client?.name}</p>
        </div>
        <Link to={`/admin/clientes/${id}`} className="btn btn-outline">
          {t("common.close")}
        </Link>
      </div>

      {mode === "list" && (
        <>
          <div className="card admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("profiling.seller")}</th>
                  <th>{t("profiling.property")}</th>
                  <th>{t("profiling.createdAt")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={4}>{t("profiling.noResults")}</td>
                  </tr>
                ) : (
                  list.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nombre_completo}</td>
                      <td>{item.ubicacion}</td>
                      <td>{formatFecha(item.fecha_creacion)}</td>
                      <td className="admin-table__actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openPerfilamiento(item.id)}>
                          {t("profiling.open")}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => downloadById(item.id)}
                          disabled={busyPdfId === item.id}
                        >
                          {busyPdfId === item.id ? <span className="spinner" /> : null}
                          {t("profiling.downloadPdf")}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="profiling-actions">
            <button type="button" className="btn btn-primary" onClick={startNew}>
              {t("profiling.new")}
            </button>
          </div>
        </>
      )}

      {mode === "form" && (
        <form
          className="card admin-form profiling-form"
          onSubmit={(e) => {
            e.preventDefault();
            save({ withPdf: false });
          }}
          noValidate
        >
          <h2 className="profiling-section-title">{t("profiling.sellerSection")}</h2>
          <FieldGroup fields={VENDEDOR_FIELDS} form={form} errors={errors} onChange={handleChange} />

          <h2 className="profiling-section-title">{t("profiling.propertySection")}</h2>
          <FieldGroup fields={INMUEBLE_FIELDS} form={form} errors={errors} onChange={handleChange} />

          <div className="admin-form__actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="spinner" /> : null}
              {t("common.save")}
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save({ withPdf: true })}>
              {t("profiling.saveAndPdf")}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setErrors({});
                setMode(current ? "read" : "list");
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      {mode === "read" && current && (
        <div className="card admin-form">
          <h2 className="profiling-section-title">{t("profiling.sellerSection")}</h2>
          <ReadSection fields={VENDEDOR_FIELDS} perfilamiento={current} />

          <h2 className="profiling-section-title">{t("profiling.propertySection")}</h2>
          <ReadSection fields={INMUEBLE_FIELDS} perfilamiento={current} />

          <div className="admin-form__actions">
            <button type="button" className="btn btn-primary" onClick={startEdit}>
              {t("common.edit")}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => downloadById(current.id)}
              disabled={busyPdfId === current.id}
            >
              {busyPdfId === current.id ? <span className="spinner" /> : null}
              {t("profiling.downloadPdf")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setMode("list")}>
              {t("profiling.backToList")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Los <input> son controlados: null de la base de datos debe volverse "", y las
// fechas deben quedar como aaaa-mm-dd (lo que espera <input type="date">).
function toFormValues(perfilamiento) {
  const values = {};
  for (const [key, value] of Object.entries(perfilamiento)) {
    if (value == null) {
      values[key] = "";
      continue;
    }
    const text = String(value);
    values[key] = /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
  }
  return values;
}

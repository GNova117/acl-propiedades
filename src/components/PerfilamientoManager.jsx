import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  emptyForm,
  isFieldVisible,
  displayValue,
  formatFecha,
  validateSections,
  toPayload,
  toFormValues,
} from "../lib/perfilamientoShared";
import { downloadPerfilamientoPdf } from "../lib/perfilamientoPdf";
import "../pages/admin/AdminClientProfiling.css";

function FieldInput({ field, value, error, revealed, onToggleReveal, onChange }) {
  const id = `perf-${field.key}`;
  const common = {
    id,
    value: value ?? "",
    onChange: (e) => onChange(field.key, e.target.value),
    "aria-invalid": error ? "true" : undefined,
  };

  if (field.sensitive) {
    return (
      <div className="profiling-sensitive-input">
        <input {...common} type={revealed ? "text" : "password"} autoComplete="off" />
        <button type="button" className="btn btn-outline btn-sm" onClick={onToggleReveal}>
          {revealed ? "🙈" : "👁"}
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
  if (field.type === "number") return <input {...common} type="number" min="0" step="0.01" />;
  if (field.type === "integer") return <input {...common} type="number" min="0" step="1" />;
  if (field.type === "email") return <input {...common} type="email" />;
  if (field.type === "tel") return <input {...common} type="tel" inputMode="numeric" maxLength={10} />;
  return <input {...common} type="text" />;
}

function FieldGroup({ fields, form, errors, revealedKeys, onToggleReveal, onChange }) {
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
            <FieldInput
              field={field}
              value={form[field.key]}
              error={errors[field.key]}
              revealed={revealedKeys.has(field.key)}
              onToggleReveal={() => onToggleReveal(field.key)}
              onChange={onChange}
            />
            {errors[field.key] && <span className="form-error">{errors[field.key]}</span>}
          </div>
        );
      })}
    </div>
  );
}

function ReadSection({ fields, record, revealedKeys, onToggleReveal }) {
  const visible = fields.filter((field) => isFieldVisible(field, record) && displayValue(field, record));
  if (visible.length === 0) return <p className="form-hint">—</p>;
  return (
    <dl className="profiling-read">
      {visible.map((field) => (
        <div key={field.key} className="profiling-read__row">
          <dt>{field.label}</dt>
          <dd>
            {field.sensitive && !revealedKeys.has(field.key) ? (
              <span className="profiling-sensitive-value">
                ••••••••
                <button type="button" className="btn btn-outline btn-sm" onClick={() => onToggleReveal(field.key)}>
                  👁
                </button>
              </span>
            ) : (
              displayValue(field, record)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Componente genérico de lista + formulario + lectura de un tipo de
// perfilamiento (vendedor, comprador, o cualquiera nuevo). Cada tipo solo
// aporta su configuración: secciones, backend, columnas de lista y textos.
export default function PerfilamientoManager({
  clienteId,
  sections,
  extraRules,
  nombreKey,
  pdfTitle,
  filePrefix,
  listColumns,
  emptyMessageKey,
  newLabelKey,
  backend,
}) {
  const { t } = useTranslation();

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("list"); // list | form | read
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(() => emptyForm(sections));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyPdfId, setBusyPdfId] = useState(null);
  const [revealedKeys, setRevealedKeys] = useState(new Set());

  const load = () => {
    setLoading(true);
    backend.list(clienteId).then((data) => {
      setList(data);
      setLoading(false);
    });
  };

  useEffect(load, [clienteId]);

  const toggleReveal = (key) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleChange = (key, rawValue) => {
    const field = sections.flatMap((s) => s.fields).find((f) => f.key === key);
    let value = rawValue;
    if (field?.uppercase) value = value.toUpperCase();
    if (field?.format === "telefono" || field?.format === "nss") value = value.replace(/\D/g, "").slice(0, field.format === "nss" ? 11 : 10);
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const startNew = () => {
    setCurrent(null);
    setForm(emptyForm(sections));
    setErrors({});
    setRevealedKeys(new Set());
    setMode("form");
  };

  const openRecord = async (id) => {
    const full = await backend.getById(id);
    if (!full) return;
    setCurrent(full);
    setRevealedKeys(new Set());
    setMode("read");
  };

  const startEdit = () => {
    setForm({ ...emptyForm(sections), ...toFormValues(current) });
    setErrors({});
    setMode("form");
  };

  const pdfOptions = { title: pdfTitle };

  const save = async ({ withPdf }) => {
    const nextErrors = validateSections(sections, form, extraRules);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = toPayload(sections, form);
      const saved = current ? await backend.update(current.id, payload) : await backend.add(clienteId, payload);
      const full = (await backend.getById(saved.id)) || saved;
      setCurrent(full);
      setMode("read");
      load();
      if (withPdf) {
        await downloadPerfilamientoPdf(full, sections, pdfOptions, full[nombreKey], filePrefix);
      }
    } catch (err) {
      window.alert(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const downloadById = async (id) => {
    setBusyPdfId(id);
    try {
      const full = await backend.getById(id);
      if (full) await downloadPerfilamientoPdf(full, sections, pdfOptions, full[nombreKey], filePrefix);
    } catch (err) {
      window.alert(err.message || "Error al generar el PDF");
    } finally {
      setBusyPdfId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await backend.remove(id);
    if (current?.id === id) {
      setCurrent(null);
      setMode("list");
    }
    load();
  };

  if (loading) return <div className="empty-state">{t("common.loading")}</div>;

  return (
    <div>
      {mode === "list" && (
        <>
          <div className="card admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  {listColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={listColumns.length + 1}>{t(emptyMessageKey)}</td>
                  </tr>
                ) : (
                  list.map((item) => (
                    <tr key={item.id}>
                      {listColumns.map((col) => (
                        <td key={col.key}>{col.format === "fecha" ? formatFecha(item[col.key]) : item[col.key]}</td>
                      ))}
                      <td className="admin-table__actions">
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openRecord(item.id)}>
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
              {t(newLabelKey)}
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
          {sections.map((section) => (
            <div key={section.key}>
              <h2 className="profiling-section-title">{t(section.titleKey)}</h2>
              <FieldGroup
                fields={section.fields}
                form={form}
                errors={errors}
                revealedKeys={revealedKeys}
                onToggleReveal={toggleReveal}
                onChange={handleChange}
              />
            </div>
          ))}

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
          {sections.map((section) => (
            <div key={section.key}>
              <h2 className="profiling-section-title">{t(section.titleKey)}</h2>
              <ReadSection fields={section.fields} record={current} revealedKeys={revealedKeys} onToggleReveal={toggleReveal} />
            </div>
          ))}

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

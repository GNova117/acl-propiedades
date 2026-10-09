import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { db } from "../../lib/dataStore";
import { emptyForm, validateSections, toPayload, toFormValues, formatFecha } from "../../lib/perfilamientoShared";
import { downloadSolicitudCreditoPdf } from "../../lib/solicitudCreditoPdf";
import { FieldGroup, ReadSection } from "../../components/PerfilamientoManager";
import {
  SOLICITUD_CREDITO_SECTIONS,
  solicitudCreditoNombre,
  clienteToDerechohabienteCredito,
  propiedadToViviendaCredito,
} from "../../lib/solicitudCredito";
import "./AdminClientProfiling.css";
import "./admin.css";

export default function AdminSolicitudCredito() {
  const { t } = useTranslation();
  const location = useLocation();

  const [list, setList] = useState([]);
  const [clients, setClients] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("list"); // list | form | read
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(() => emptyForm(SOLICITUD_CREDITO_SECTIONS));
  const [clienteId, setClienteId] = useState("");
  const [propiedadId, setPropiedadId] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [busyPdfId, setBusyPdfId] = useState(null);
  const [revealedKeys] = useState(new Set());

  const load = () => {
    setLoading(true);
    db.getSolicitudesCredito()
      .then(setList)
      .catch((err) => {
        console.error("AdminSolicitudCredito: no se pudo cargar la lista", err);
        setList([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    db.getClients().then(setClients).catch(() => setClients([]));
    db.getProperties().then(setProperties).catch(() => setProperties([]));
  }, []);

  // Llega aquí desde la ficha de un cliente INFONAVIT (botón "Solicitud de
  // crédito" en AdminClientForm) con el cliente ya elegido — abre
  // directamente una solicitud nueva con ese cliente preseleccionado, sin
  // que el asesor tenga que volver a buscarlo en el combo.
  useEffect(() => {
    const prefillId = location.state?.prefillClienteId;
    if (!prefillId || clients.length === 0) return;
    setCurrent(null);
    setForm(emptyForm(SOLICITUD_CREDITO_SECTIONS));
    setPropiedadId("");
    setErrors({});
    setMode("form");
    handleClienteChange(prefillId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, location.state]);

  const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const propertyById = Object.fromEntries(properties.map((p) => [p.id, p]));

  const handleChange = (key, rawValue) => {
    const field = SOLICITUD_CREDITO_SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key);
    let value = rawValue;
    if (field?.uppercase) value = value.toUpperCase();
    if (field?.format === "telefono" || field?.format === "nss") {
      value = value.replace(/\D/g, "").slice(0, field.format === "nss" ? 11 : 10);
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Solo rellena los campos que el formulario todavía tiene vacíos — nunca
  // pisa algo que el asesor ya haya escrito o corregido a mano.
  const fillEmpty = (patch) => {
    setForm((prev) => {
      const next = { ...prev };
      for (const [key, value] of Object.entries(patch)) {
        if (!next[key]) next[key] = value;
      }
      return next;
    });
  };

  // Al elegir el cliente derechohabiente se precarga la sección 5 con sus
  // datos generales y, si tiene un perfilamiento de comprador capturado,
  // con ese detalle (NSS, CURP, domicilio, teléfono, correo). Si el cliente
  // está segmentado como "infonavit" (ver clients.financiamiento), también
  // se preselecciona el producto de la sección 1 — sigue siendo editable.
  const handleClienteChange = async (id) => {
    setClienteId(id);
    const client = clientById[id];
    if (!client) return;
    if (client.financiamiento === "infonavit") fillEmpty({ producto: "Infonavit" });
    try {
      const perfiles = await db.getPerfilamientosComprador(id);
      const full = perfiles[0] ? await db.getPerfilamientoCompradorById(perfiles[0].id) : null;
      fillEmpty(clienteToDerechohabienteCredito(client, full));
    } catch {
      fillEmpty(clienteToDerechohabienteCredito(client, null));
    }
  };

  // Al elegir la propiedad se precarga la sección 3 con su dirección y zona.
  const handlePropiedadChange = (id) => {
    setPropiedadId(id);
    fillEmpty(propiedadToViviendaCredito(propertyById[id]));
  };

  const startNew = () => {
    setCurrent(null);
    setForm(emptyForm(SOLICITUD_CREDITO_SECTIONS));
    setClienteId("");
    setPropiedadId("");
    setErrors({});
    setMode("form");
  };

  const openRecord = async (id) => {
    const full = await db.getSolicitudCreditoById(id);
    if (!full) return;
    setCurrent(full);
    setClienteId(full.cliente_id || "");
    setPropiedadId(full.propiedad_id || "");
    setMode("read");
  };

  const startEdit = () => {
    setForm({ ...emptyForm(SOLICITUD_CREDITO_SECTIONS), ...toFormValues(current) });
    setErrors({});
    setMode("form");
  };

  const save = async ({ withPdf }) => {
    const nextErrors = validateSections(SOLICITUD_CREDITO_SECTIONS, form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const payload = { ...toPayload(SOLICITUD_CREDITO_SECTIONS, form), cliente_id: clienteId || null, propiedad_id: propiedadId || null };
      const saved = current ? await db.updateSolicitudCredito(current.id, payload) : await db.addSolicitudCredito(payload);
      const full = (await db.getSolicitudCreditoById(saved.id)) || saved;
      setCurrent(full);
      setMode("read");
      load();
      if (withPdf) {
        await downloadSolicitudCreditoPdf(full, solicitudCreditoNombre(full));
      }
    } catch (err) {
      window.alert(err.message || t("solicitudCredito.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const downloadById = async (id) => {
    setBusyPdfId(id);
    try {
      const full = await db.getSolicitudCreditoById(id);
      if (!full) throw new Error(t("solicitudCredito.notFound"));
      await downloadSolicitudCreditoPdf(full, solicitudCreditoNombre(full));
    } catch (err) {
      window.alert(err.message || t("solicitudCredito.pdfError"));
    } finally {
      setBusyPdfId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t("common.confirmDelete"))) return;
    await db.deleteSolicitudCredito(id);
    if (current?.id === id) {
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
          <h1>{t("solicitudCredito.title")}</h1>
          <p className="form-hint">{t("solicitudCredito.subtitle")}</p>
        </div>
      </div>

      {mode === "list" && (
        <>
          <div className="card admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t("solicitudCredito.list.derechohabiente")}</th>
                  <th>{t("solicitudCredito.list.vivienda")}</th>
                  <th>{t("solicitudCredito.list.destino")}</th>
                  <th>{t("solicitudCredito.list.createdAt")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={5}>{t("solicitudCredito.list.empty")}</td>
                  </tr>
                ) : (
                  list.map((item) => (
                    <tr key={item.id}>
                      <td>
                        {solicitudCreditoNombre(item)}
                        {clientById[item.cliente_id] ? ` · ${clientById[item.cliente_id].name}` : ""}
                      </td>
                      <td>{item.viv_calle || propertyById[item.propiedad_id]?.title || "—"}</td>
                      <td>{item.destino_credito || "—"}</td>
                      <td>{formatFecha(item.fecha_creacion)}</td>
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
              {t("solicitudCredito.new")}
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
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="sc-cliente">{t("solicitudCredito.linkClient")}</label>
              <select id="sc-cliente" value={clienteId} onChange={(e) => handleClienteChange(e.target.value)}>
                <option value="">{t("valuation.history.none")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="form-hint">{t("solicitudCredito.linkClientHint")}</span>
            </div>
            <div className="form-field">
              <label htmlFor="sc-propiedad">{t("solicitudCredito.linkProperty")}</label>
              <select id="sc-propiedad" value={propiedadId} onChange={(e) => handlePropiedadChange(e.target.value)}>
                <option value="">{t("valuation.history.none")}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {SOLICITUD_CREDITO_SECTIONS.map((section) => (
            <div key={section.key}>
              <h2 className="profiling-section-title">{t(section.titleKey)}</h2>
              <FieldGroup fields={section.fields} form={form} errors={errors} revealedKeys={revealedKeys} onToggleReveal={() => {}} onChange={handleChange} />
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
          <div className="form-row">
            <div>
              <span className="form-hint">{t("solicitudCredito.linkClient")}</span>
              <p>{clientById[current.cliente_id]?.name || "—"}</p>
            </div>
            <div>
              <span className="form-hint">{t("solicitudCredito.linkProperty")}</span>
              <p>{propertyById[current.propiedad_id]?.title || "—"}</p>
            </div>
          </div>

          {SOLICITUD_CREDITO_SECTIONS.map((section) => (
            <div key={section.key}>
              <h2 className="profiling-section-title">{t(section.titleKey)}</h2>
              <ReadSection fields={section.fields} record={current} revealedKeys={revealedKeys} onToggleReveal={() => {}} />
            </div>
          ))}

          <div className="admin-form__actions">
            <button type="button" className="btn btn-primary" onClick={startEdit}>
              {t("common.edit")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => downloadById(current.id)} disabled={busyPdfId === current.id}>
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

import { useEffect, useMemo, useState } from "react";
import { db } from "../../lib/dataStore";
import { exportToCsv } from "../../lib/csvExport";
import "./admin.css";
import "./AdminSecretaria.css";

// Bitácoras de Secretaría: (1) control de llaves y (2) entradas/salidas de
// documentos. Es un registro interno: solo se agregan filas y, en llaves, se
// registra la devolución. Texto en español fijo (herramienta interna, como
// Construcción).

const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const nowTimeStr = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (date, time) => new Date(`${date}T${time || "00:00"}`).toISOString();
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—");
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
const sameDay = (iso, ymd) => Boolean(iso) && new Date(iso).toDateString() === new Date(`${ymd}T00:00`).toDateString();

const emptyKey = () => ({ date: todayStr(), time: nowTimeStr(), address: "", key_label: "", receiver_name: "", receiver_phone: "", signed_delivery: false, notes: "" });
const emptyDoc = () => ({ date: todayStr(), time: nowTimeStr(), doc_type: "", property_client: "", movement: "entrada", person_name: "", person_id: "", signed: false, secretary_name: "" });

export default function AdminSecretaria() {
  const [tab, setTab] = useState("keys");
  const [keys, setKeys] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyForm, setKeyForm] = useState(emptyKey);
  const [docForm, setDocForm] = useState(emptyDoc);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([db.getSecretariaLog("keys"), db.getSecretariaLog("docs")])
      .then(([k, d]) => {
        setKeys(k);
        setDocs(d);
        setError("");
      })
      .catch((err) => setError(err.message || "Error"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const pending = useMemo(() => keys.filter((k) => !k.returned_at), [keys]);
  const matches = (row, fields) => {
    const q = search.trim().toLowerCase();
    return !q || fields.some((f) => String(row[f] || "").toLowerCase().includes(q));
  };
  const visibleKeys = keys.filter((k) => (!onlyPending || !k.returned_at) && matches(k, ["address", "key_label", "receiver_name", "receiver_phone"]));
  const visibleDocs = docs.filter((d) => matches(d, ["doc_type", "property_client", "person_name", "person_id", "secretary_name"]));

  const run = async (fn) => {
    setSaving(true);
    try {
      await fn();
      load();
    } catch (err) {
      window.alert(err.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const submitKey = (e) => {
    e.preventDefault();
    const f = keyForm;
    run(async () => {
      await db.addSecretariaLog("keys", {
        logged_at: toIso(f.date, f.time),
        address: f.address.trim(),
        key_label: f.key_label.trim(),
        receiver_name: f.receiver_name.trim(),
        receiver_phone: f.receiver_phone.trim() || null,
        signed_delivery: f.signed_delivery,
        returned_at: null,
        signed_reception: false,
        notes: f.notes.trim() || null,
      });
      setKeyForm(emptyKey());
    });
  };

  const submitDoc = (e) => {
    e.preventDefault();
    const f = docForm;
    run(async () => {
      await db.addSecretariaLog("docs", {
        logged_at: toIso(f.date, f.time),
        doc_type: f.doc_type.trim(),
        property_client: f.property_client.trim(),
        movement: f.movement,
        person_name: f.person_name.trim(),
        person_id: f.person_id.trim() || null,
        signed: f.signed,
        secretary_name: f.secretary_name.trim() || null,
      });
      setDocForm({ ...emptyDoc(), secretary_name: f.secretary_name });
    });
  };

  const registerReturn = (row) => {
    const signed = window.confirm(`Llave ${row.key_label}: ¿quien la devuelve firmó la recepción?\n\nAceptar = sí firmó · Cancelar = no firmó`);
    run(() => db.updateSecretariaLog("keys", row.id, { returned_at: new Date().toISOString(), signed_reception: signed }));
  };

  const remove = (kind, id) => {
    if (!window.confirm("¿Borrar este registro? No se puede deshacer.")) return;
    run(() => db.deleteSecretariaLog(kind, id));
  };

  const closingToday = useMemo(() => {
    const today = todayStr();
    return { out: keys.filter((k) => sameDay(k.logged_at, today)).length, back: keys.filter((k) => sameDay(k.returned_at, today)).length };
  }, [keys]);

  const exportKeys = () =>
    exportToCsv("control-de-llaves.csv", visibleKeys, [
      { label: "Fecha", value: (r) => fmtDate(r.logged_at) },
      { label: "Hora", value: (r) => fmtTime(r.logged_at) },
      { label: "Dirección / Casa", key: "address" },
      { label: "ID / Nombre de llave", key: "key_label" },
      { label: "Nombre de quien recibe", key: "receiver_name" },
      { label: "Teléfono / Contacto", key: "receiver_phone" },
      { label: "Firmó entrega", value: (r) => (r.signed_delivery ? "Sí" : "No") },
      { label: "Hora devolución", value: (r) => fmtTime(r.returned_at) },
      { label: "Firmó recepción", value: (r) => (r.returned_at ? (r.signed_reception ? "Sí" : "No") : "") },
      { label: "Observaciones", key: "notes" },
    ]);

  const exportDocs = () =>
    exportToCsv("entradas-salidas-documentos.csv", visibleDocs, [
      { label: "Fecha", value: (r) => fmtDate(r.logged_at) },
      { label: "Hora", value: (r) => fmtTime(r.logged_at) },
      { label: "Tipo de documento", key: "doc_type" },
      { label: "Propiedad / Cliente", key: "property_client" },
      { label: "Movimiento", value: (r) => (r.movement === "entrada" ? "Entrada" : "Salida") },
      { label: "Persona que entrega / recoge", key: "person_name" },
      { label: "Identificación / Contacto", key: "person_id" },
      { label: "Firma de conformidad", value: (r) => (r.signed ? "Sí" : "No") },
      { label: "Responsable en Secretaría", key: "secretary_name" },
    ]);

  const setK = (k) => (e) => setKeyForm({ ...keyForm, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setD = (k) => (e) => setDocForm({ ...docForm, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div>
      <div className="admin-header">
        <h1>Secretaría</h1>
      </div>

      {error && <p className="form-error">No se pudieron cargar las bitácoras: {error}</p>}

      <div className="sec-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "keys"} className={tab === "keys" ? "is-active" : ""} onClick={() => setTab("keys")}>
          Control de llaves {pending.length > 0 && <span className="sec-badge">{pending.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === "docs"} className={tab === "docs" ? "is-active" : ""} onClick={() => setTab("docs")}>
          Entradas y salidas de documentos
        </button>
      </div>

      <div className="card sec-tips">
        <strong>Recomendaciones de uso</strong>
        <ul>
          <li><b>Control físico:</b> asigna una clave única a cada juego de llaves (ej. C-01 para Casa 1) y etiquétalo físicamente para que coincida con la bitácora.</li>
          <li><b>Verificación de identidad:</b> pide una identificación oficial (INE) o registra el teléfono antes de entregar cualquier llave o documento original.</li>
          <li><b>Cierre diario:</b> al terminar el día revisa ambos registros y confirma que todas las llaves prestadas hayan regresado a resguardo.</li>
        </ul>
      </div>

      <div className="form-field sec-search">
        <label htmlFor="sec-search">Buscar</label>
        <input id="sec-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Casa, llave, persona, teléfono…" />
      </div>

      {tab === "keys" ? (
        <>
          <div className={`card sec-closing ${pending.length ? "sec-closing--warn" : "sec-closing--ok"}`}>
            <strong>Cierre diario:</strong>{" "}
            {pending.length === 0
              ? "todas las llaves están en resguardo."
              : `${pending.length} ${pending.length === 1 ? "llave sigue prestada" : "llaves siguen prestadas"}: ${pending.map((k) => `${k.key_label} (${k.receiver_name})`).join(", ")}.`}
            <span className="sec-closing__today">Hoy: {closingToday.out} entregadas · {closingToday.back} devueltas.</span>
          </div>

          <form className="card sec-form" onSubmit={submitKey}>
            <h2>Registrar entrega de llave</h2>
            <div className="sec-grid">
              <div className="form-field"><label>Fecha</label><input type="date" required value={keyForm.date} onChange={setK("date")} /></div>
              <div className="form-field"><label>Hora</label><input type="time" required value={keyForm.time} onChange={setK("time")} /></div>
              <div className="form-field"><label>Dirección / Casa</label><input required value={keyForm.address} onChange={setK("address")} placeholder="Ej. Av. Hidalgo #123" /></div>
              <div className="form-field"><label>ID / Nombre de llave</label><input required value={keyForm.key_label} onChange={setK("key_label")} placeholder="Ej. P-01 (Principal)" /></div>
              <div className="form-field"><label>Nombre de quien recibe</label><input required value={keyForm.receiver_name} onChange={setK("receiver_name")} placeholder="Ej. Juan Pérez" /></div>
              <div className="form-field"><label>Teléfono / Contacto</label><input required value={keyForm.receiver_phone} onChange={setK("receiver_phone")} placeholder="871-XXX-XXXX" /></div>
              <div className="form-field sec-grid__wide"><label>Observaciones</label><input value={keyForm.notes} onChange={setK("notes")} placeholder="Sin novedades" /></div>
              <label className="sec-check"><input type="checkbox" checked={keyForm.signed_delivery} onChange={setK("signed_delivery")} /> Firmó la entrega</label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>Guardar entrega</button>
          </form>

          <div className="sec-toolbar">
            <label className="sec-check"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Solo llaves pendientes de devolver</label>
            <button type="button" className="btn btn-outline" onClick={exportKeys} disabled={visibleKeys.length === 0}>Exportar CSV</button>
          </div>

          <div className="card admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Hora</th><th>Dirección / Casa</th><th>Llave</th><th>Recibe</th><th>Teléfono</th>
                  <th>Firmó entrega</th><th>Devolución</th><th>Firmó recepción</th><th>Observaciones</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11}>Cargando…</td></tr>
                ) : visibleKeys.length === 0 ? (
                  <tr><td colSpan={11}>{keys.length === 0 ? "Aún no hay llaves registradas." : "Sin resultados."}</td></tr>
                ) : (
                  visibleKeys.map((r) => (
                    <tr key={r.id} className={r.returned_at ? "" : "sec-row--pending"}>
                      <td>{fmtDate(r.logged_at)}</td>
                      <td>{fmtTime(r.logged_at)}</td>
                      <td>{r.address}</td>
                      <td>{r.key_label}</td>
                      <td>{r.receiver_name}</td>
                      <td>{r.receiver_phone || "—"}</td>
                      <td>{r.signed_delivery ? "Sí" : "No"}</td>
                      <td>{r.returned_at ? `${fmtDate(r.returned_at)} ${fmtTime(r.returned_at)}` : <span className="sec-pill">Prestada</span>}</td>
                      <td>{r.returned_at ? (r.signed_reception ? "Sí" : "No") : "—"}</td>
                      <td>{r.notes || "—"}</td>
                      <td className="admin-table__actions">
                        {!r.returned_at && <button type="button" className="btn btn-primary btn-sm" onClick={() => registerReturn(r)} disabled={saving}>Registrar devolución</button>}
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove("keys", r.id)} disabled={saving}>Borrar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <form className="card sec-form" onSubmit={submitDoc}>
            <h2>Registrar movimiento de documento</h2>
            <div className="sec-grid">
              <div className="form-field"><label>Fecha</label><input type="date" required value={docForm.date} onChange={setD("date")} /></div>
              <div className="form-field"><label>Hora</label><input type="time" required value={docForm.time} onChange={setD("time")} /></div>
              <div className="form-field"><label>Tipo de documento</label><input required value={docForm.doc_type} onChange={setD("doc_type")} placeholder="Escrituras / Contrato" /></div>
              <div className="form-field"><label>Propiedad / Cliente</label><input required value={docForm.property_client} onChange={setD("property_client")} placeholder="Casa #45 - Col. Centro" /></div>
              <div className="form-field">
                <label>Movimiento</label>
                <select value={docForm.movement} onChange={setD("movement")}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                </select>
              </div>
              <div className="form-field"><label>Persona que entrega / recoge</label><input required value={docForm.person_name} onChange={setD("person_name")} placeholder="María López" /></div>
              <div className="form-field"><label>Identificación / Contacto</label><input required value={docForm.person_id} onChange={setD("person_id")} placeholder="INE: XXXX" /></div>
              <div className="form-field"><label>Responsable en Secretaría</label><input required value={docForm.secretary_name} onChange={setD("secretary_name")} placeholder="Nombre" /></div>
              <label className="sec-check"><input type="checkbox" checked={docForm.signed} onChange={setD("signed")} /> Firmó de conformidad</label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>Guardar movimiento</button>
          </form>

          <div className="sec-toolbar">
            <span />
            <button type="button" className="btn btn-outline" onClick={exportDocs} disabled={visibleDocs.length === 0}>Exportar CSV</button>
          </div>

          <div className="card admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Hora</th><th>Tipo de documento</th><th>Propiedad / Cliente</th><th>Movimiento</th>
                  <th>Entrega / Recoge</th><th>Identificación</th><th>Firma</th><th>Responsable</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10}>Cargando…</td></tr>
                ) : visibleDocs.length === 0 ? (
                  <tr><td colSpan={10}>{docs.length === 0 ? "Aún no hay movimientos registrados." : "Sin resultados."}</td></tr>
                ) : (
                  visibleDocs.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.logged_at)}</td>
                      <td>{fmtTime(r.logged_at)}</td>
                      <td>{r.doc_type}</td>
                      <td>{r.property_client}</td>
                      <td><span className={`sec-pill sec-pill--${r.movement}`}>{r.movement === "entrada" ? "Entrada" : "Salida"}</span></td>
                      <td>{r.person_name}</td>
                      <td>{r.person_id || "—"}</td>
                      <td>{r.signed ? "Sí" : "No"}</td>
                      <td>{r.secretary_name || "—"}</td>
                      <td className="admin-table__actions">
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => remove("docs", r.id)} disabled={saving}>Borrar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/dataStore";
import { queries } from "../lib/queries";
import { useQuery } from "../lib/useQuery";
import { isOnline } from "../lib/offlineQueue";
import { MAX_IMPORT_ROWS, isImportable, markRepeats, parseProspectInput, prospectFieldsFromRow, rowIssues } from "../lib/prospectImport";
import "./PropertyProspectsModal.css";
import "./ProspectImportModal.css";

const NONE = [];
const MAX_FILE_BYTES = 1_000_000;
const CHECK_PARALLEL = 5; // consultas de duplicados a la vez

// «Pegar o importar lista»: el asesor pega nombres y teléfonos (de un chat o una lista de WhatsApp), sube un CSV (Facebook Lead
// Ads, una hoja de cálculo) o contactos compartidos (.vcf), revisa lo que se entendió —puede corregir cada renglón— y se guardan
// como prospectos nuevos. Los que ya existen (por teléfono o correo, también los de otros asesores y los clientes) o se repiten
// en la lista vienen sin marcar. Lógica de lectura en lib/prospectImport.js.
//   onImported(creados) — los prospectos recién guardados, para que la pantalla de fondo los muestre;
//   onClose — cierra la ventana.
export default function ProspectImportModal({ onClose, onImported }) {
  const { t } = useTranslation();
  const { advisorId } = useAuth();
  const advisorsQ = useQuery(queries.advisors);
  const advisors = advisorsQ.data ?? NONE;
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState(null); // { kind, truncated } una vez leído el texto
  const [rows, setRows] = useState([]); // { id, name, phone, email, notes, looking_for, repeated, include, dupes }
  const [checking, setChecking] = useState(0); // consultas de duplicados en curso
  const [assignTo, setAssignTo] = useState(advisorId || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      alive.current = false;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const patchRow = (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ¿Ya existe? Por teléfono o correo, contra prospectos (de todos) y clientes. Un fallo de la consulta no bloquea: el renglón queda como nuevo.
  const checkDuplicates = async (targets) => {
    const queue = targets.filter((r) => isImportable(r));
    setChecking((n) => n + queue.length);
    const worker = async () => {
      while (queue.length) {
        const row = queue.shift();
        let dupes = [];
        try {
          dupes = (await db.findContactDuplicates({ phone: row.phone, email: row.email })) || [];
        } catch {
          dupes = [];
        }
        if (alive.current) {
          setRows((list) =>
            list.map((r) => (r.id === row.id && r.phone === row.phone && r.email === row.email ? { ...r, dupes, include: dupes.length > 0 ? false : r.include } : r))
          );
          setChecking((n) => n - 1);
        }
      }
    };
    await Promise.all(Array.from({ length: CHECK_PARALLEL }, worker));
  };

  const review = (source = text) => {
    setError("");
    const out = parseProspectInput(source);
    if (out.rows.length === 0) {
      setError(t("prospectImport.nothing"));
      return;
    }
    const initial = out.rows.map((r) => ({ ...r, include: isImportable(r) && !r.repeated, dupes: null }));
    setParsed({ kind: out.kind, truncated: out.truncated });
    setRows(initial);
    checkDuplicates(initial);
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError(t("prospectImport.fileTooBig"));
      return;
    }
    try {
      const content = await file.text();
      setText(content);
      review(content);
    } catch {
      setError(t("prospectImport.fileError"));
    }
  };

  // Al corregir un renglón se vuelve a ver si repite a otro de la lista; uno que estaba mal y ya quedó bien se marca solo (después
  // se consulta si ya existe, al salir del campo).
  const edit = (id, patch) =>
    setRows((list) => {
      const before = list.find((r) => r.id === id);
      return markRepeats(list.map((r) => (r.id === id ? { ...r, ...patch, dupes: null } : r))).map((r) => {
        if (r.id !== id) return r;
        const ok = isImportable(r) && !r.repeated;
        // Cambiar el teléfono o el correo (o arreglar un renglón que estaba mal) lo deja marcado; si resulta que ya existe, la consulta lo desmarca.
        const reconsidered = "phone" in patch || "email" in patch || !isImportable(before);
        return { ...r, include: ok ? (reconsidered ? true : before.include) : false };
      });
    });
  const recheck = (id) => {
    const row = rows.find((r) => r.id === id);
    if (row && isImportable(row) && row.dupes === null) checkDuplicates([row]);
  };

  const selected = useMemo(() => rows.filter((r) => r.include && isImportable(r)), [rows]);
  const skipped = rows.length - selected.length;

  const save = async () => {
    setError("");
    if (!isOnline()) {
      setError(t("prospectImport.needOnline"));
      return;
    }
    setSaving(true);
    try {
      const created = await db.addProspects(selected.map((r) => prospectFieldsFromRow(r, { advisorId: assignTo || null })));
      onImported?.(created);
      setDoneCount(created.length);
    } catch (err) {
      setError(err.message || t("prospectImport.error"));
    } finally {
      setSaving(false);
    }
  };

  const dupeText = (d) =>
    t("prospectImport.dupe", {
      name: d.name,
      kind: d.kind === "client" ? t("prospectImport.kinds.client") : t("prospectImport.kinds.prospect"),
    }) + (d.kind === "prospect" && d.advisor_name ? ` · ${d.advisor_name}` : "");

  return (
    <div className="match-modal" role="dialog" aria-modal="true" aria-label={t("prospectImport.title")}>
      <div className="match-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="match-modal__box card prospect-import">
        <div className="match-modal__head">
          <h2>{t("prospectImport.title")}</h2>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {doneCount !== null ? (
          <>
            <p role="status">{t("prospectImport.done", { count: doneCount })}</p>
            <p className="form-hint">{t("prospectImport.doneHint")}</p>
            <div className="prospect-import__actions">
              <button type="button" className="btn btn-primary" onClick={onClose}>
                {t("prospectImport.finish")}
              </button>
            </div>
          </>
        ) : !parsed ? (
          <>
            <p className="form-hint">{t("prospectImport.intro")}</p>
            <div className="form-field">
              <label htmlFor="import-text">{t("prospectImport.pasteLabel")}</label>
              <textarea id="import-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("prospectImport.pastePlaceholder")} />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="prospect-import__actions">
              <button type="button" className="btn btn-primary" onClick={() => review()} disabled={!text.trim()}>
                {t("prospectImport.review")}
              </button>
              <label className="btn btn-outline prospect-import__file">
                {t("prospectImport.file")}
                <input type="file" accept=".csv,.txt,.vcf,text/csv,text/plain,text/vcard,text/x-vcard" onChange={readFile} aria-label={t("prospectImport.file")} />
              </label>
            </div>
          </>
        ) : (
          <>
            <p className="form-hint" aria-live="polite">
              {t("prospectImport.found", { count: rows.length, kind: t(`prospectImport.kind.${parsed.kind}`) })}
              {parsed.truncated ? ` ${t("prospectImport.truncated", { max: MAX_IMPORT_ROWS })}` : ""}
              {checking > 0 ? ` ${t("prospectImport.checking")}` : ""}
            </p>

            {advisorId == null && (
              <div className="form-field">
                <label htmlFor="import-advisor">{t("prospectImport.assignTo")}</label>
                <select id="import-advisor" value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                  <option value="">{t("prospectImport.noAdvisor")}</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ul className="prospect-import__list">
              {rows.map((row, index) => {
                const issues = rowIssues(row);
                const importable = issues.length === 0;
                return (
                  <li key={row.id} className={`prospect-import__row${row.include && importable ? " is-on" : ""}`} data-row={index}>
                    <label className="prospect-import__pick">
                      <input
                        type="checkbox"
                        checked={row.include && importable}
                        disabled={!importable}
                        onChange={(e) => patchRow(row.id, { include: e.target.checked })}
                        aria-label={t("prospectImport.pick", { name: row.name || row.phone || row.email })}
                      />
                    </label>
                    <div className="prospect-import__fields">
                      <input value={row.name} onChange={(e) => edit(row.id, { name: e.target.value })} aria-label={t("prospectImport.columns.name")} placeholder={t("prospectImport.columns.name")} />
                      <input
                        value={row.phone}
                        inputMode="tel"
                        onChange={(e) => edit(row.id, { phone: e.target.value })}
                        onBlur={() => recheck(row.id)}
                        aria-label={t("prospectImport.columns.phone")}
                        placeholder={t("prospectImport.columns.phone")}
                      />
                      <input
                        value={row.email}
                        inputMode="email"
                        onChange={(e) => edit(row.id, { email: e.target.value })}
                        onBlur={() => recheck(row.id)}
                        aria-label={t("prospectImport.columns.email")}
                        placeholder={t("prospectImport.columns.email")}
                      />
                    </div>
                    <div className="prospect-import__flags">
                      {issues.map((issue) => (
                        <span key={issue} className="prospect-chip prospect-chip--overdue">
                          {t(`prospectImport.issues.${issue}`)}
                        </span>
                      ))}
                      {row.repeated && <span className="prospect-chip prospect-chip--today">{t("prospectImport.repeated")}</span>}
                      {(row.dupes || []).map((d, i) => (
                        <span key={`${d.kind}-${d.id || i}`} className="prospect-chip prospect-chip--today">
                          {dupeText(d)}
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>

            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="prospect-import__actions">
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || selected.length === 0}>
                {saving ? t("prospectImport.importing") : t("prospectImport.import", { count: selected.length })}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setParsed(null)} disabled={saving}>
                {t("prospectImport.back")}
              </button>
              <span className="form-hint">{t("prospectImport.summary", { ready: selected.length, skipped })}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

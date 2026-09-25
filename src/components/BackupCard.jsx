import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MEMORY_LIMIT_BYTES, canBackupFiles, downloadBackup, isBackupStale, lastBackupAt, prepareFullBackupSink, runFullBackup } from "../lib/backup";

// Tarjeta de respaldo (Roles y accesos). Es manual a propósito: un respaldo
// automático necesitaría una llave de servidor de Supabase fuera del navegador.
// En su lugar avisa cuando pasaron más de 7 días sin descargar uno.
// Dos formas: solo datos (JSON, segundos) o completo (ZIP con los datos y
// todas las fotos y documentos del Storage).
export default function BackupCard() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [last, setLast] = useState(lastBackupAt());
  const [includeVideos, setIncludeVideos] = useState(false);
  const [fullRunning, setFullRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [fullResult, setFullResult] = useState(null);
  const abortRef = useRef(null);
  const stale = isBackupStale();

  const handleBackup = async () => {
    setRunning(true);
    setError("");
    try {
      const meta = await downloadBackup();
      setResult(meta);
      setLast(meta.created_at);
    } catch (err) {
      setError(err.message || t("backup.error"));
    } finally {
      setRunning(false);
    }
  };

  const handleFull = async () => {
    setError("");
    setFullResult(null);
    let sink;
    try {
      // Primero el "Guardar como": el navegador solo lo permite directo desde el clic.
      sink = await prepareFullBackupSink();
    } catch (err) {
      if (err?.name !== "AbortError") setError(err.message || t("backup.error"));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setFullRunning(true);
    setProgress({ phase: "listing" });
    try {
      const outcome = await runFullBackup({
        sink,
        includeVideos,
        signal: controller.signal,
        onProgress: setProgress,
        confirmSize: async ({ count, bytes, sink: s }) => {
          const mb = Math.round(bytes / 1048576);
          if (s.kind === "memory" && bytes > MEMORY_LIMIT_BYTES) {
            window.alert(t("backup.tooBigForMemory", { mb }));
            return false;
          }
          return window.confirm(t("backup.confirmFull", { count, mb }));
        },
      });
      if (!outcome.cancelled) {
        setFullResult(outcome);
        setLast(outcome.at);
      }
    } catch (err) {
      if (err?.name !== "AbortError") setError(err.message || t("backup.error"));
    } finally {
      setFullRunning(false);
      setProgress(null);
      abortRef.current = null;
    }
  };

  const failed = result ? Object.keys(result.errors || {}) : [];
  const rowCount = result ? Object.values(result.counts).reduce((a, b) => a + b, 0) : 0;
  const busy = running || fullRunning;

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
      <h2 style={{ marginTop: 0 }}>{t("backup.title")}</h2>
      <p className="form-hint">{t("backup.hint")}</p>
      <p style={{ margin: "0.75rem 0" }}>
        {last ? (
          <>
            {t("backup.last")}: <strong>{new Date(last).toLocaleString("es-MX")}</strong>
          </>
        ) : (
          t("backup.never")
        )}
        {stale && <span className="form-error"> · {t("backup.stale", { days: 7 })}</span>}
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={handleBackup} disabled={busy}>
        {running ? <span className="spinner" /> : null}
        {running ? t("backup.running") : t("backup.download")}
      </button>
      {error && <p className="form-error">{error}</p>}
      {result && (
        <p className="form-hint" style={{ marginTop: "0.75rem" }}>
          {t("backup.done", { rows: rowCount, tables: Object.keys(result.counts).length, mb: (result.bytes / 1048576).toFixed(2) })}
          {failed.length > 0 && <span className="form-error"> {t("backup.partial", { tables: failed.join(", ") })}</span>}
        </p>
      )}

      {canBackupFiles && (
        <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
          <h3 style={{ marginTop: 0 }}>{t("backup.fullTitle")}</h3>
          <p className="form-hint">{t("backup.fullHint")}</p>
          <label className="access-control__checkbox" style={{ marginBottom: "0.75rem" }}>
            <input type="checkbox" checked={includeVideos} onChange={(e) => setIncludeVideos(e.target.checked)} disabled={busy} />
            {t("backup.includeVideos")}
          </label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleFull} disabled={busy}>
              {fullRunning ? <span className="spinner" /> : null}
              {t("backup.fullDownload")}
            </button>
            {fullRunning && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => abortRef.current?.abort()}>
                {t("backup.cancel")}
              </button>
            )}
          </div>
          {fullRunning && progress && (
            <p className="form-hint" style={{ marginTop: "0.6rem" }}>
              {progress.phase === "files" ? t("backup.progress", { done: progress.done + 1, total: progress.total }) : t(`backup.phase_${progress.phase}`)}
            </p>
          )}
          {fullResult && (
            <p className="form-hint" style={{ marginTop: "0.6rem" }}>
              {t("backup.fullDone", { added: fullResult.added, mb: (fullResult.bytes / 1048576).toFixed(1) })}
              {fullResult.failed.length > 0 && <span className="form-error"> {t("backup.failedFiles", { count: fullResult.failed.length })}</span>}
            </p>
          )}
        </div>
      )}

      <p className="form-hint" style={{ marginTop: "0.75rem" }}>{t("backup.warning")}</p>
    </div>
  );
}

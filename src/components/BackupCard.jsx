import { useState } from "react";
import { useTranslation } from "react-i18next";
import { downloadBackup, isBackupStale, lastBackupAt } from "../lib/backup";

// Tarjeta de respaldo (Roles y accesos). Es manual a propósito: un respaldo
// automático necesitaría una llave de servidor de Supabase fuera del navegador.
// En su lugar avisa cuando pasaron más de 7 días sin descargar uno.
export default function BackupCard() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [last, setLast] = useState(lastBackupAt());
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

  const failed = result ? Object.keys(result.errors || {}) : [];
  const rowCount = result ? Object.values(result.counts).reduce((a, b) => a + b, 0) : 0;

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
      <button type="button" className="btn btn-primary btn-sm" onClick={handleBackup} disabled={running}>
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
      <p className="form-hint" style={{ marginTop: "0.75rem" }}>{t("backup.warning")}</p>
    </div>
  );
}

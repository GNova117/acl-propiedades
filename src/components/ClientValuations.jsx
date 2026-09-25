import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import { formatMXN } from "../lib/format";
import { downloadValuationPdf } from "../lib/valuationPdf";
import { valuationPdfLabels, valuationRowToPdfData } from "../lib/valuationShare";

// Estimaciones de valor ligadas a un cliente, para su expediente. Quien no
// tenga el apartado de estimación recibe error o lista vacía por RLS: en ese
// caso la tarjeta simplemente no aparece.
export default function ClientValuations({ clientId }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    db.getValuationEstimates()
      .then((all) => setRows(all.filter((r) => r.client_id === clientId)))
      .catch(() => setRows([]));
  }, [clientId]);

  if (rows.length === 0) return null;

  const download = async (row) => {
    setBusyId(row.id);
    try {
      await downloadValuationPdf(valuationRowToPdfData(row), valuationPdfLabels(t));
    } catch (err) {
      window.alert(err.message || t("valuation.pdf.error"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h2 style={{ marginTop: 0 }}>{t("valuation.history.clientTitle")}</h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {rows.map((row) => (
          <li key={row.id} style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span className="form-hint" style={{ flex: "1 1 12rem" }}>
              {new Date(row.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
              {row.zone_name ? ` · ${row.zone_name}` : ""}
              {row.reference ? ` · ${row.reference}` : ""}
            </span>
            <strong>
              {formatMXN(row.low)} – {formatMXN(row.high)}
            </strong>
            <button type="button" className="btn btn-outline btn-sm" disabled={busyId === row.id} onClick={() => download(row)}>
              {t("valuation.pdf.download")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

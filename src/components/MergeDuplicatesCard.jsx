import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "../lib/dataStore";
import "./DuplicateWarning.css";
import { confirmDialog } from "../lib/toast";

// «Posibles duplicados» de un prospecto ya guardado: otros prospectos con el mismo teléfono o correo. Cada uno propio
// se puede fusionar AQUÍ (se conserva este, y su historia —etapas, contactos, citas, selecciones y notas— pasa a él).
// El de otro asesor solo se avisa: no se puede abrir ni fusionar. Clientes con ese teléfono o correo se avisan sin
// fusionar (un cliente tiene expediente y trámites que esta fusión no toca). `onMerged(removedId)`.
export default function MergeDuplicatesCard({ prospect, onMerged }) {
  const { t } = useTranslation();
  const [found, setFound] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    db.findContactDuplicates({ phone: prospect.phone, email: prospect.email, excludeProspectId: prospect.id })
      .then((list) => !cancelled && setFound(list))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [prospect.id, prospect.phone, prospect.email]);

  if (found.length === 0) return null;

  const merge = async (dup) => {
    if (!await confirmDialog(t("mergeDuplicates.confirm", { keep: prospect.name, remove: dup.name }))) return;
    setBusyId(dup.id);
    setError("");
    try {
      await db.mergeProspects(prospect.id, dup.id);
      setFound((list) => list.filter((d) => d.id !== dup.id));
      onMerged?.(dup.id);
    } catch (err) {
      const reason = /^merge:(\w+)$/.exec(String(err?.message || ""))?.[1];
      setError(t(`mergeDuplicates.errors.${reason || "generic"}`, { defaultValue: t("mergeDuplicates.errors.generic") }));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="duplicate-warning" role="region" aria-label={t("mergeDuplicates.title")}>
      <strong>{t("mergeDuplicates.title")}</strong>
      <ul>
        {found.map((d, i) => (
          <li key={`${d.kind}-${d.id || i}`}>
            <strong>{d.name}</strong>{" "}
            <span className="form-hint">
              {[d.kind === "client" ? t("duplicates.client") : t("duplicates.prospect", { stage: t(`prospects.stages.${d.stage}`) }), d.kind === "prospect" && !d.mine ? t("duplicates.ofAdvisor", { name: d.advisor_name || "—" }) : null, t(`duplicates.matched.${d.matched}`)]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {d.kind === "prospect" && d.mine && d.id && (
              <button type="button" className="btn btn-outline btn-sm" disabled={busyId === d.id} onClick={() => merge(d)}>
                {t("mergeDuplicates.merge")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="form-hint">{t("mergeDuplicates.hint")}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

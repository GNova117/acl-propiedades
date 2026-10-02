import { useEffect, useState } from "react";
import { db } from "../../lib/dataStore";
import { describeSyncError } from "../../lib/construccion/sync";
import type { FotoHabitacion, Proyecto } from "../../lib/construccion/types";

type Props = {
  proyecto: Proyecto;
};

// Pestaña "Fotos": una foto con nota por cuarto, agrupadas por nivel igual que
// Resumen y Presupuesto. Las fotos no viven en `proyecto` (a diferencia de
// habitaciones/objetos) porque cargan su propia URL firmada y no tiene caso
// reenviarlas en cada guardado automático del plano — se leen y escriben
// directo contra `db`, como en Remodelaciones.
export default function FotosTab({ proyecto }: Props) {
  const [fotosPorHabitacion, setFotosPorHabitacion] = useState<Record<string, FotoHabitacion[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingHabitacionId, setPendingHabitacionId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [pendingNota, setPendingNota] = useState("");
  const [saving, setSaving] = useState(false);

  const habitacionIds = proyecto.habitaciones.map((h) => h.id);
  const habitacionIdsKey = habitacionIds.join(",");

  const load = () => {
    setLoading(true);
    db.getConstruccionFotos(habitacionIds)
      .then((data: Record<string, FotoHabitacion[]>) => {
        setFotosPorHabitacion(data);
        setError(null);
      })
      .catch((err: unknown) => setError(describeSyncError(err)))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [habitacionIdsKey]);

  const resetPending = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingHabitacionId(null);
    setPendingFile(null);
    setPendingPreview(null);
    setPendingNota("");
  };

  const handleFileSelect = (habitacionId: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingHabitacionId(habitacionId);
    setPendingFile(file);
    setPendingPreview(URL.createObjectURL(file));
    setPendingNota("");
  };

  const handleConfirmAdd = async () => {
    if (!pendingFile || !pendingHabitacionId) return;
    setSaving(true);
    try {
      const orden = (fotosPorHabitacion[pendingHabitacionId]?.length ?? 0) + 1;
      await db.addConstruccionFoto({ proyectoId: proyecto.id, habitacionId: pendingHabitacionId, file: pendingFile, nota: pendingNota.trim(), orden });
      resetPending();
      load();
    } catch (err) {
      window.alert(describeSyncError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fotoId: string, habitacionId: string) => {
    if (!window.confirm("¿Eliminar esta foto? No se puede deshacer.")) return;
    try {
      await db.deleteConstruccionFoto(fotoId);
      setFotosPorHabitacion((prev) => ({ ...prev, [habitacionId]: (prev[habitacionId] ?? []).filter((f) => f.id !== fotoId) }));
    } catch (err) {
      window.alert(describeSyncError(err));
    }
  };

  const handleNotaBlur = async (foto: FotoHabitacion, nota: string) => {
    if (nota === (foto.nota ?? "")) return;
    try {
      await db.updateConstruccionFotoNota(foto.id, nota);
      setFotosPorHabitacion((prev) => ({
        ...prev,
        [foto.habitacionId]: (prev[foto.habitacionId] ?? []).map((f) => (f.id === foto.id ? { ...f, nota: nota || null } : f)),
      }));
    } catch (err) {
      window.alert(describeSyncError(err));
    }
  };

  if (loading) return <p className="empty-state">Cargando…</p>;

  return (
    <div className="construccion-panel">
      <div className="construccion-panel__narrow" style={{ maxWidth: "48rem" }}>
        {error && <p className="construccion__error">{error}</p>}
        <p className="construccion-panel__hint">
          Una foto por cuarto no basta para un reporte — agrega varias con una nota cada una (acabado, pendiente, daño visible…); van en la ficha PDF
          agrupadas por habitación.
        </p>

        {proyecto.habitaciones.length === 0 ? (
          <p className="empty-state">Todavía no hay habitaciones — créalas en la pestaña Editor.</p>
        ) : (
          proyecto.niveles.map((nivel) => {
            const habsDelNivel = proyecto.habitaciones.filter((h) => h.nivelId === nivel.id);
            if (habsDelNivel.length === 0) return null;
            return (
              <div key={nivel.id} className="construccion-panel__subgroup">
                {proyecto.niveles.length > 1 && <h3 className="construccion-panel__subheading">{nivel.nombre}</h3>}
                {habsDelNivel.map((h) => {
                  const fotos = fotosPorHabitacion[h.id] ?? [];
                  return (
                    <section key={h.id} className="construccion-fotos__room">
                      <h4 className="construccion-fotos__room-name">{h.nombre}</h4>

                      {fotos.length === 0 && pendingHabitacionId !== h.id && <p className="construccion-panel__hint">Sin fotos todavía.</p>}

                      <div className="construccion-fotos__grid">
                        {fotos.map((foto) => (
                          <div key={foto.id} className="construccion-fotos__card">
                            {foto.signedUrl ? (
                              <img src={foto.signedUrl} alt="" className="construccion-fotos__thumb" />
                            ) : (
                              <div className="construccion-fotos__thumb construccion-fotos__thumb--broken">sin vista previa</div>
                            )}
                            <textarea
                              rows={2}
                              defaultValue={foto.nota ?? ""}
                              placeholder="Nota (opcional)"
                              className="construccion-fotos__note"
                              onBlur={(e) => handleNotaBlur(foto, e.target.value.trim())}
                            />
                            <button type="button" className="construccion-panel__link-danger" onClick={() => handleDelete(foto.id, h.id)}>
                              eliminar
                            </button>
                          </div>
                        ))}

                        {pendingHabitacionId === h.id && pendingFile && (
                          <div className="construccion-fotos__card">
                            <img src={pendingPreview ?? ""} alt="" className="construccion-fotos__thumb" />
                            <textarea
                              rows={2}
                              placeholder="Nota (opcional)"
                              className="construccion-fotos__note"
                              value={pendingNota}
                              onChange={(e) => setPendingNota(e.target.value)}
                              autoFocus
                            />
                            <div className="construccion-fotos__pending-actions">
                              <button type="button" className="btn btn-primary btn-sm" onClick={handleConfirmAdd} disabled={saving}>
                                {saving ? <span className="spinner" /> : null}
                                Guardar
                              </button>
                              <button type="button" className="btn btn-outline btn-sm" onClick={resetPending} disabled={saving}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {pendingHabitacionId !== h.id && (
                        <label className="btn btn-outline btn-sm construccion-fotos__add" style={{ cursor: "pointer" }}>
                          <input type="file" accept="image/*" onChange={handleFileSelect(h.id)} hidden />
                          + Agregar foto
                        </label>
                      )}
                    </section>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

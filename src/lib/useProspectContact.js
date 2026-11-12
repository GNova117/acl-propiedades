import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { db } from "./dataStore";
import { contactUpdate } from "./prospectContacts";
import { enqueueContact, isOfflineError, isOnline, withTimeout } from "./offlineQueue";

// Estado del formulario "Registrar contacto" de un prospecto (el que se abre
// bajo su tarjeta o su ficha). Lo comparten Prospectos, Mi día y la ficha:
//   open(prospecto, canal?, forzar?) — abre el formulario (o lo cierra si ya
//     estaba abierto en ese prospecto; `forzar` lo deja abierto, para cuando
//     el asesor acaba de mandar un WhatsApp o llamar y el canal ya se sabe);
//   save(prospecto, valores) — guarda el contacto en el historial (o, sin señal, en la cola de este
//     dispositivo: ver lib/offlineQueue.js), actualiza
//     al prospecto (último contacto, etapa, siguiente seguimiento; `stage` opcional
//     avanza la etapa) y avisa con
//     `onUpdated(prospectoActualizado)`.
export function useProspectContact({ onUpdated } = {}) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const email = session?.user?.email || "";
  const [target, setTarget] = useState(null); // { id, channel }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const open = (prospect, channel = "", force = false) => {
    setError("");
    setTarget((current) => (!force && current?.id === prospect.id ? null : { id: prospect.id, channel }));
  };

  const close = () => setTarget(null);

  const save = async (prospect, { channel, note, nextFollowup, stage }) => {
    setSaving(true);
    setError("");
    const fields = contactUpdate(prospect, { nextFollowup, stage });
    // Sin señal: el contacto se guarda en este dispositivo (se envía solo al volver la conexión) y el tablero
    // ya lo muestra. `maybeSent`: la petición pudo haber llegado aunque no respondió a tiempo.
    const saveOffline = (maybeSent) => {
      if (!enqueueContact(email, { prospect, channel, note, nextFollowup, stage, maybeSent })) {
        setError(t("offline.saveFailed"));
        return;
      }
      onUpdated?.({ ...prospect, ...fields, updated_at: new Date().toISOString() });
      setTarget(null);
    };
    try {
      if (!isOnline()) {
        saveOffline(false);
        return;
      }
      const updated = await withTimeout(db.logProspectContact(prospect.id, fields, { channel, note }));
      onUpdated?.(updated);
      setTarget(null);
    } catch (err) {
      if (isOfflineError(err)) saveOffline(err?.name === "OfflineTimeout");
      else setError(err.message || t("prospects.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return { target, saving, error, open, close, save, isOpenFor: (id) => target?.id === id };
}

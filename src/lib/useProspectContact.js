import { useState } from "react";
import { useTranslation } from "react-i18next";
import { db } from "./dataStore";
import { contactFields } from "./prospects";

// Estado del formulario "Registrar contacto" de un prospecto (el que se abre
// bajo su tarjeta o su ficha). Lo comparten Prospectos, Mi día y la ficha:
//   open(prospecto, canal?, forzar?) — abre el formulario (o lo cierra si ya
//     estaba abierto en ese prospecto; `forzar` lo deja abierto, para cuando
//     el asesor acaba de mandar un WhatsApp o llamar y el canal ya se sabe);
//   save(prospecto, valores) — guarda el contacto en el historial, actualiza
//     al prospecto (último contacto, etapa, siguiente seguimiento) y avisa con
//     `onUpdated(prospectoActualizado)`.
export function useProspectContact({ onUpdated } = {}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(null); // { id, channel }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const open = (prospect, channel = "", force = false) => {
    setError("");
    setTarget((current) => (!force && current?.id === prospect.id ? null : { id: prospect.id, channel }));
  };

  const close = () => setTarget(null);

  const save = async (prospect, { channel, note, nextFollowup }) => {
    setSaving(true);
    setError("");
    try {
      const updated = await db.logProspectContact(prospect.id, contactFields(prospect, nextFollowup), { channel, note });
      onUpdated?.(updated);
      setTarget(null);
    } catch (err) {
      setError(err.message || t("prospects.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return { target, saving, error, open, close, save, isOpenFor: (id) => target?.id === id };
}

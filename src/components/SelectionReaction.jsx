import { useState } from "react";
import { useTranslation } from "react-i18next";
import { nextReaction, REACTION_COMMENT_MAX } from "../lib/selections";
import "./SelectionReaction.css";

// «Me gusta / No es para mí» y un comentario, debajo de cada propiedad de la selección pública. No guarda
// nada por sí mismo: llama a `onSave(reaction, comment)` (que devuelve { ok } o { error }). El asesor que
// previsualiza la página (`readOnly`) ve los botones pero no escribe nada.
export default function SelectionReaction({ title, entry, onSave, readOnly = false }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(entry?.c || "");
  const [open, setOpen] = useState(Boolean(entry?.c));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState(false);
  const reaction = entry?.r || null;

  const save = async (nextReactionValue, nextComment) => {
    if (readOnly) return;
    setBusy(true);
    setError("");
    setSavedNote(false);
    try {
      const result = await onSave(nextReactionValue, nextComment);
      if (result?.error) setError(t(`selectionReactions.errors.${result.error}`, { defaultValue: t("selectionReactions.errors.generic") }));
      else setSavedNote(true);
    } catch {
      setError(t("selectionReactions.errors.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="selection-reaction">
      <div className="selection-reaction__buttons" role="group" aria-label={t("selectionReactions.groupLabel", { title })}>
        <button
          type="button"
          className={`selection-reaction__btn${reaction === "like" ? " is-active is-like" : ""}`}
          aria-pressed={reaction === "like"}
          disabled={busy}
          onClick={() => save(nextReaction(reaction, "like"), entry?.c || null)}
        >
          <span aria-hidden="true">👍</span> {t("selectionReactions.like")}
        </button>
        <button
          type="button"
          className={`selection-reaction__btn${reaction === "dislike" ? " is-active is-dislike" : ""}`}
          aria-pressed={reaction === "dislike"}
          disabled={busy}
          onClick={() => save(nextReaction(reaction, "dislike"), entry?.c || null)}
        >
          <span aria-hidden="true">👎</span> {t("selectionReactions.dislike")}
        </button>
        <button type="button" className="selection-reaction__link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {entry?.c ? t("selectionReactions.editComment") : t("selectionReactions.addComment")}
        </button>
      </div>

      {open && (
        <form
          className="selection-reaction__comment"
          onSubmit={(e) => {
            e.preventDefault();
            save(reaction, draft);
          }}
        >
          <label className="visually-hidden" htmlFor={`reaction-comment-${title}`}>{t("selectionReactions.commentLabel", { title })}</label>
          <textarea
            id={`reaction-comment-${title}`}
            rows={2}
            value={draft}
            maxLength={REACTION_COMMENT_MAX}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("selectionReactions.commentPlaceholder")}
          />
          <button type="submit" className="btn btn-outline btn-sm" disabled={busy || draft.trim() === (entry?.c || "")}>
            {t("selectionReactions.saveComment")}
          </button>
        </form>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {savedNote && !error && <p className="form-hint" role="status">{t("selectionReactions.saved")}</p>}
    </div>
  );
}
